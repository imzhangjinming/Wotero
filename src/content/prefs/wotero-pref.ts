export enum WoteroPref {
  collectionSyncConfigs = 'collectionSyncConfigs',
  wolaiDatabaseID = 'wolaiDatabaseID',
  wolaiToken = 'wolaiToken',
  pageTitleFormat = 'pageTitleFormat',
  syncOnModifyItems = 'syncOnModifyItems',
}

export enum PageTitleFormat {
  itemAuthorDateCitation = 'itemAuthorDateCitation',
  itemFullCitation = 'itemFullCitation',
  itemInTextCitation = 'itemInTextCitation',
  itemShortTitle = 'itemShortTitle',
  itemTitle = 'itemTitle',
}

type WoteroPrefValue = Partial<{
  [WoteroPref.collectionSyncConfigs]: string;
  [WoteroPref.wolaiDatabaseID]: string;
  [WoteroPref.wolaiToken]: string;
  [WoteroPref.pageTitleFormat]: PageTitleFormat;
  [WoteroPref.syncOnModifyItems]: boolean;
}>;

function buildFullPrefName(pref: WoteroPref): string {
  return `extensions.wotero.${pref}`;
}

function getBooleanPref(value: Zotero.Prefs.Value): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function getStringPref(value: Zotero.Prefs.Value): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}

function isPageTitleFormat(
  value: Zotero.Prefs.Value
): value is PageTitleFormat {
  return (
    typeof value === 'string' &&
    Object.values<string>(PageTitleFormat).includes(value)
  );
}

function getPageTitleFormatPref(
  value: Zotero.Prefs.Value
): PageTitleFormat | undefined {
  return isPageTitleFormat(value) ? value : undefined;
}

export function clearWoteroPref(pref: WoteroPref): void {
  Zotero.Prefs.clear(buildFullPrefName(pref), true);
}

export function getWoteroPref<P extends WoteroPref>(
  pref: P
): WoteroPrefValue[P] {
  const value = Zotero.Prefs.get(buildFullPrefName(pref), true);

  const booleanPref = getBooleanPref(value);
  const stringPref = getStringPref(value);

  const pageTitleFormatPref =
    (pref === WoteroPref.pageTitleFormat && getPageTitleFormatPref(value)) ||
    undefined;

  return {
    [WoteroPref.collectionSyncConfigs]: stringPref,
    [WoteroPref.wolaiDatabaseID]: stringPref,
    [WoteroPref.wolaiToken]: stringPref,
    [WoteroPref.pageTitleFormat]: pageTitleFormatPref,
    [WoteroPref.syncOnModifyItems]: booleanPref,
  }[pref];
}

export function setWoteroPref<P extends WoteroPref>(
  pref: P,
  value: WoteroPrefValue[P]
): void {
  Zotero.Prefs.set(buildFullPrefName(pref), value, true);
}
