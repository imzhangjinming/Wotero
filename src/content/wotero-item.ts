import Wolai from './wolai';
import { buildCollectionFullName } from './utils';

const APA_STYLE = 'bibliography=http://www.zotero.org/styles/apa';

const PARENS_REGEX = /^\((.+)\)$/;

export default class WoteroItem {
  static WOLAI_TAG_NAME = 'wolai';

  private static formatCreatorName({ firstName, lastName }: Zotero.Creator) {
    return [lastName, firstName].filter((name) => name).join(', ');
  }

  private static getQuickCopyFormat(): string {
    const format = Zotero.Prefs.get('export.quickCopy.setting');

    if (typeof format === 'string' && format) {
      return format;
    }
    return APA_STYLE;
  }

  private readonly zoteroItem: Zotero.Item;
  private cachedCitations: Record<string, string | null> = {};

  public constructor(zoteroItem: Zotero.Item) {
    this.zoteroItem = zoteroItem; // 使用传入的Zotero.Item初始化类内的zoteroItem
  }

  // 获取文献摘要
  public getAbstract(): string | null {
    return this.zoteroItem.getField('abstractNote') || null;
  }

  // 获取文献作者
  public getAuthors(): string[] {
    const primaryCreatorTypeID = Zotero.CreatorTypes.getPrimaryIDForType(
      this.zoteroItem.itemTypeID
    );

    return this.zoteroItem
      .getCreators()
      .filter(({ creatorTypeID }) => creatorTypeID === primaryCreatorTypeID)
      .map(WoteroItem.formatCreatorName);
  }

  // 获取分类信息
  public getCollections(): string[] {
    return Zotero.Collections.get(this.zoteroItem.getCollections()).map(
      buildCollectionFullName
    );
  }

  // 获取日期
  public getDate(): string | null {
    return this.zoteroItem.getField('date') || null;
  }

  // 获取DOI
  public getDOI(): string | null {
    const doi = this.zoteroItem.getField('DOI');
    return doi ? `https://doi.org/${doi}` : null;
  }

  // 获取编辑名
  public getEditors(): string[] {
    return this.zoteroItem
      .getCreators()
      .filter(
        ({ creatorTypeID }) =>
          Zotero.CreatorTypes.getName(creatorTypeID) === 'editor'
      )
      .map(WoteroItem.formatCreatorName);
  }

  // 获取文件路径信息
  public async getFilePath(): Promise<string | null> {
    const attachment = await this.zoteroItem.getBestAttachment();
    if (!attachment) return null;

    return (await attachment.getFilePathAsync()) || null;
  }

  // 获取引用信息
  private getCitation(
    format: string,
    inTextCitation: boolean
  ): Promise<string | null> {
    return new Promise((resolve) => {
      const result = Zotero.QuickCopy.getContentFromItems(
        [this.zoteroItem],
        format,
        (obj, worked) => {
          resolve(worked ? obj.string.trim() : null);
        },
        inTextCitation
      );

      if (result === false) {
        resolve(null);
      } else if (result !== true) {
        resolve(result.text.trim());
      }
    });
  }

  // 获取缓存的引用信息
  private async getCachedCitation(
    format: string,
    inTextCitation: boolean
  ): Promise<string | null> {
    const cacheKey = `${format}-${String(inTextCitation)}`;

    if (this.cachedCitations[cacheKey] === undefined) {
      this.cachedCitations[cacheKey] = await this.getCitation(
        format,
        inTextCitation
      );
    }
    return this.cachedCitations[cacheKey];
  }

  // 获取作者、日期和引用信息
  public async getAuthorDateCitation(): Promise<string | null> {
    const citation = await this.getCachedCitation(APA_STYLE, true);
    return citation?.match(PARENS_REGEX)?.[1] || null;
  }

  public getFullCitation(): Promise<string | null> {
    return this.getCachedCitation(WoteroItem.getQuickCopyFormat(), false);
  }

  public getInTextCitation(): Promise<string | null> {
    return this.getCachedCitation(WoteroItem.getQuickCopyFormat(), true);
  }

  // 获取条目类型：书籍、期刊文章、学位论文...
  public getItemType(): string {
    return Zotero.ItemTypes.getLocalizedString(this.zoteroItem.itemTypeID);
  }

  // 获取短标题
  public getShortTitle(): string | null {
    return this.zoteroItem.getField('shortTitle') || null;
  }

  public getTags(): string[] {
    return this.zoteroItem
      .getTags()
      .map(({ tag }) => tag)
      .filter((tag) => tag !== WoteroItem.WOLAI_TAG_NAME);
  }

  // 获取条目标题
  public getTitle(): string {
    return this.zoteroItem.getDisplayTitle();
  }

  // 获取条目的URL地址
  public getURL(): string | null {
    return this.zoteroItem.getField('url') || null;
  }

  // 获取条目的出版年份
  public getYear(): number | null {
    const year = Number.parseInt(this.zoteroItem.getField('year') || '');
    return Number.isNaN(year) ? null : year;
  }

  // 获取条目的zotero在线版网址
  public getZoteroURI(): string {
    return Zotero.URI.getItemURI(this.zoteroItem);
  }

  //
  public getWolaiLinkAttachments(): Zotero.Item[] {
    const attachmentIDs = this.zoteroItem
      .getAttachments(false)
      .slice()
      // Sort to get largest ID first
      .sort((a, b) => b - a);

    return Zotero.Items.get(attachmentIDs).filter((attachment) =>
      {
        attachment.getDisplayTitle().toLowerCase() === WoteroItem.WOLAI_TAG_NAME
      }
    );
  }

  public getWolaiPageID(): string | undefined {
    const wolaiURL = this.getWolaiLinkAttachments()[0]?.getField('url');
    return wolaiURL && Wolai.getPageIDFromURL(wolaiURL);
  }

  public async saveWolaiLinkAttachment(webURL: string): Promise<void> {
    const appURL = Wolai.convertWebURLToAppURL(webURL);
    const attachments = this.getWolaiLinkAttachments();

    if (attachments.length > 1) {
      const attachmentIDs = attachments.slice(1).map(({ id }) => id);
      await Zotero.Items.erase(attachmentIDs);
    }

    let attachment = attachments.length ? attachments[0] : null;

    if (attachment) {
      attachment.setField('url', appURL);
    } else {
      attachment = await Zotero.Attachments.linkFromURL({
        parentItemID: this.zoteroItem.id,
        title: 'Wolai',
        url: appURL,
        saveOptions: {
          skipNotifier: true,
        },
      });
    }

    attachment.setNote(`
<h2 style="background-color: #ff666680;">Do not delete!</h2>
<p>This link attachment serves as a reference for
<a href="https://github.com/imzhangjinming/Wotero">Wotero</a>
so that it can properly update the Wolai page for this item.</p>
<p>Last synced: ${new Date().toLocaleString()}</p>
`);

    await attachment.saveTx();
  }

  public async saveWolaiTag(): Promise<void> {
    this.zoteroItem.addTag(WoteroItem.WOLAI_TAG_NAME);
    await this.zoteroItem.saveTx({ skipNotifier: true });
  }
}
