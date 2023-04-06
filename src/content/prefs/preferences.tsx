import React from 'react';
// eslint-disable-next-line import/no-unresolved
import ReactDOM from 'react-dom';

import { getLocalizedString, getXULElementById } from '../utils';
import SyncConfigsTable from './sync-configs-table';

import { PageTitleFormat } from './wotero-pref';

class Preferences {
  private pageTitleFormatMenu!: XUL.MenuListElement;

  public async init(): Promise<void> {
    this.pageTitleFormatMenu = getXULElementById('wotero-pageTitleFormat');

    await Zotero.uiReadyPromise;

    this.initPageTitleFormatMenu();

    ReactDOM.render(
      <SyncConfigsTable />,
      document.getElementById('wotero-syncConfigsTable-container')
    );
  }

  private initPageTitleFormatMenu(): void {
    Object.values(PageTitleFormat).forEach((format) => {
      const label = getLocalizedString(`wotero.pageTitleFormat.${format}`);
      const item = this.pageTitleFormatMenu.appendItem(label, format);
      if (format === this.pageTitleFormatMenu.value) {
        this.pageTitleFormatMenu.selectedItem = item;
      }
    });
    this.pageTitleFormatMenu.disabled = false;
  }

  public openReadme(): void {
    Zotero.launchURL('https://github.com/imzhangjinming/Wotero#readme');
  }
}

module.exports = {
  preferences: new Preferences(),
};
