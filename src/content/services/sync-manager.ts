import { loadSyncEnabledCollectionIDs } from '../prefs/collection-sync-config';
import {
  getWoteroPref,
  WoteroPref,
  PageTitleFormat,
} from '../prefs/wotero-pref';
import {
  getAllCollectionItems,
  getLocalizedString,
  hasErrorStack,
  log,
} from '../utils';
import WoteroItem from '../wotero-item';
import Wolai from '../wolai';
import { wolaiTitleBuilder } from '../wolai';

import EventManager, { NotifierEventParams } from './event-manager';
import type { Service } from './service';

const SYNC_DEBOUNCE_MS = 2000;

type QueuedSync = {
  readonly itemIDs: Set<Zotero.Item['id']>;
  timeoutID?: ReturnType<Zotero['setTimeout']>;
};

export default class SyncManager implements Service {
  private static get tickIcon() {
    return `chrome://zotero/skin/tick${Zotero.hiDPISuffix}.png`;
  }

  private readonly progressWindow = new Zotero.ProgressWindow();

  private queuedSync?: QueuedSync;

  private syncInProgress = false;

  public startup() {
    EventManager.addListener('notifier-event', this.handleNotifierEvent);
    EventManager.addListener(
      'request-sync-collection',
      this.handleSyncCollection
    );
    EventManager.addListener('request-sync-items', this.handleSyncItems);
  }

  public shutdown() {
    EventManager.removeListener('notifier-event', this.handleNotifierEvent);
    EventManager.removeListener(
      'request-sync-collection',
      this.handleSyncCollection
    );
    EventManager.removeListener('request-sync-items', this.handleSyncItems);
  }

  private handleNotifierEvent = (...params: NotifierEventParams) => {
    this.handleEventItems(this.getItemsForNotifierEvent(...params), true);
  };

  private handleSyncCollection = (collection: Zotero.Collection) => {
    this.handleEventItems(collection.getChildItems(false), false);
  };

  private handleSyncItems = (items: Zotero.Item[]) => {
    this.handleEventItems(items, false);
  };

  private handleEventItems(
    items: Zotero.Item[],
    requireSyncedCollections: boolean
  ) {
    const collectionIDs = loadSyncEnabledCollectionIDs();
    if (requireSyncedCollections && !collectionIDs.size) return;

    // const regular_items = items.filter((item)=>!item.deleted &&
    // item.isRegularItem())

    // regular_items.forEach((item) => {
    //   if(Zotero.Items.get(
    //     item
    //       .getAttachments(false)
    //       .slice()
    //       // Sort to get largest ID first
    //       .sort((a, b) => b - a)
    //   ).filter((attachment) => attachment.getDisplayTitle()?.toLowerCase() === Wolai.TAG_NAME
    //   ).length !== 0){

    //     let temp_items = Zotero.Items.get(
    //       item
    //         .getAttachments(false)
    //         .slice()
    //         // Sort to get largest ID first
    //         .sort((a, b) => b - a)
    //     ).filter((attachment) =>
    //         attachment.getDisplayTitle().toLowerCase() === Wolai.TAG_NAME
    //     )

    //     temp_items.forEach((temp_item)=>
    //         Zotero.Items.erase(temp_item.id)
    //     )
    //   }
    // })

    const validItems = items.filter(
      (item) =>
        !item.deleted &&
        item.isRegularItem() &&
        (!requireSyncedCollections ||
          item
            .getCollections()
            .some((collectionID) => collectionIDs.has(collectionID))) &&
        Zotero.Items.get(
          item
            .getAttachments(false)
            .slice()
            // Sort to get largest ID first
            .sort((a, b) => b - a)
        ).filter(
          (attachment) =>
            attachment.getDisplayTitle().toLowerCase() === Wolai.TAG_NAME
        ).length === 0
    );

    if (validItems.length) {
      this.enqueueItemsToSync(validItems);
    }
  }

  /**
   * Return the Zotero items (if any) that should be synced for the given
   * notifier event.
   * @returns An array of Zotero items.
   */
  private getItemsForNotifierEvent(
    ...[event, ids]: NotifierEventParams
  ): Zotero.Item[] {
    const syncOnModifyItems = getWoteroPref(WoteroPref.syncOnModifyItems);

    if (!syncOnModifyItems) {
      if (event === 'collection-item.add') {
        return Zotero.Items.get(this.getIndexedIDs(1, ids));
      }
      return [];
    }

    switch (event) {
      case 'collection.delete':
      case 'collection.modify':
        return this.getItemsFromCollectionIDs(ids);
      case 'item.modify':
        return Zotero.Items.get(ids);
      case 'item-tag.modify':
      case 'item-tag.remove':
        return Zotero.Items.get(this.getIndexedIDs(0, ids));
      default:
        return [];
    }
  }

  /**
   * Extract IDs from compound IDs (e.g. `'${id0}-${id1}'`) at the given index.
   * @param index The index of the IDs to extract from compound IDs.
   * @param ids An array of compound IDs.
   * @returns An array of extracted IDs.
   */
  private getIndexedIDs(this: void, index: number, ids: number[][]) {
    return ids.map((compoundID) => compoundID[index]);
  }

  private getItemsFromCollectionIDs(this: void, ids: number[]) {
    const items = Zotero.Collections.get(ids).reduce(
      (items: Zotero.Item[], collection) =>
        items.concat(getAllCollectionItems(collection)),
      []
    );

    // Deduplicate items in multiple collections
    return Array.from(new Set(items));
  }

  private getWolai() {
    const authToken = getWoteroPref(WoteroPref.wolaiToken);
    const databaseID = getWoteroPref(WoteroPref.wolaiDatabaseID);

    if (!authToken) {
      throw new Error(`Missing ${getLocalizedString(WoteroPref.wolaiToken)}`);
    }

    if (!databaseID) {
      throw new Error(
        `Missing ${getLocalizedString(WoteroPref.wolaiDatabaseID)}`
      );
    }

    return new Wolai(authToken, databaseID);
  }

  private getwolaiTitleBuilder(): wolaiTitleBuilder {
    const titleBuilders: Record<
      PageTitleFormat,
      (item: WoteroItem) => string | null | Promise<string | null>
    > = {
      [PageTitleFormat.itemAuthorDateCitation]: (item) =>
        item.getAuthorDateCitation(),
      [PageTitleFormat.itemFullCitation]: (item) => item.getFullCitation(),
      [PageTitleFormat.itemInTextCitation]: (item) => item.getInTextCitation(),
      [PageTitleFormat.itemShortTitle]: (item) => item.getShortTitle(),
      [PageTitleFormat.itemTitle]: (item) => item.getTitle(),
    };

    const format =
      getWoteroPref(WoteroPref.pageTitleFormat) || PageTitleFormat.itemTitle;
    const buildTitle = titleBuilders[format];

    return async (item) => (await buildTitle(item)) || item.getTitle();
  }

  /**
   * Enqueue Zotero items to sync to Wolai.
   *
   * Because Zotero items can be updated multiple times in short succession,
   * any subsequent updates after the first can sometimes occur before the
   * initial sync has finished and added the Wolai link attachment. This has
   * the potential to end up creating duplicate Wolai pages.
   *
   * To address this, we use two strategies:
   * - Debounce syncs so that they occur, at most, every `SYNC_DEBOUNCE_MS` ms
   * - Prevent another sync from starting until the previous one has finished
   *
   * The algorithm works as follows:
   * 1. When enqueueing items, check if there is an existing sync queued
   *    - If not, create one with a set of the item IDs to sync and a timeout
   *      of `SYNC_DEBOUNCE_MS`
   *    - If so, add the item IDs to the existing set and restart the timeout
   * 2. When a timeout ends, check if there is a sync in progress
   *    - If not, perform the sync
   *    - If so, delete the timeout ID (to indicate it has expired)
   * 3. When a sync ends, check if there is another sync queued
   *    - If there is one with an expired timeout, perform the sync
   *    - If there is one with a remaining timeout, let it run when it times out
   *    - Otherwise, do nothing
   *
   * @param items the Zotero items to sync to Wolai
   */
  private enqueueItemsToSync(items: readonly Zotero.Item[]) {
    log(`Enqueue ${items.length} item(s) to sync`);

    if (!items.length) return;

    if (this.queuedSync?.timeoutID) {
      Zotero.clearTimeout(this.queuedSync.timeoutID);
    }

    const itemIDs = new Set([
      ...(this.queuedSync?.itemIDs?.values() ?? []),
      ...items.map(({ id }) => id),
    ]);

    const timeoutID = Zotero.setTimeout(() => {
      if (!this.queuedSync) return;

      this.queuedSync.timeoutID = undefined;
      if (!this.syncInProgress) {
        void this.performSync();
      }
    }, SYNC_DEBOUNCE_MS);

    this.queuedSync = { itemIDs, timeoutID };
  }

  private async performSync() {
    if (!this.queuedSync) return;

    const { itemIDs } = this.queuedSync;
    this.queuedSync = undefined as QueuedSync | undefined;
    this.syncInProgress = true;

    await this.saveItemsToWolai(itemIDs);

    if (this.queuedSync && !this.queuedSync.timeoutID) {
      await this.performSync();
    }

    this.syncInProgress = false;
  }

  private async saveItemsToWolai(itemIDs: Set<Zotero.Item['id']>) {
    const PERCENTAGE_MULTIPLIER = 100;

    const items = Zotero.Items.get(Array.from(itemIDs));
    if (!items.length) return;

    this.progressWindow.changeHeadline('Saving items to Wolai...');
    this.progressWindow.show();
    const itemProgress = new this.progressWindow.ItemProgress(
      'chrome://wotero/content/style/wolai_icon_32.png',
      ''
    );

    try {
      const wolai = this.getWolai();
      const wolaiBuildTitle = this.getwolaiTitleBuilder();
      let step = 0;

      for (const item of items) {
        step++;
        const progressMessage = `Item ${step} of ${items.length}`;
        log(`Saving ${progressMessage} with ID ${item.id}`);
        itemProgress.setText(progressMessage);
        try {
          await this.saveItemToWolai(item, wolai, wolaiBuildTitle);
        } catch (error) {
          const errorMessage = String(error);
          log(errorMessage, 'error');
          if (hasErrorStack(error)) {
            log(error.stack, 'error');
          }
          itemProgress.setError();
          this.progressWindow.addDescription(errorMessage);
        }
        itemProgress.setProgress((step / items.length) * PERCENTAGE_MULTIPLIER);
      }
      itemProgress.setIcon(SyncManager.tickIcon);
      this.progressWindow.startCloseTimer();
    } catch (error) {
      const errorMessage = String(error);
      log(errorMessage, 'error');
      if (hasErrorStack(error)) {
        log(error.stack, 'error');
      }
      itemProgress.setError();
      this.progressWindow.addDescription(errorMessage);
    }
  }

  private async saveItemToWolai(
    item: Zotero.Item,
    wolai: Wolai,
    buildTitle: wolaiTitleBuilder
  ) {
    const woteroItem = new WoteroItem(item);
    const response = await wolai.saveItemToDatabase(woteroItem, buildTitle);

    await woteroItem.saveWolaiTag();

    await woteroItem.saveWolaiLinkAttachment(response);
  }
}
