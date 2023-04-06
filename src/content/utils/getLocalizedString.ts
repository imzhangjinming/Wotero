import { WoteroPref } from '../prefs/wotero-pref';

Components.utils.import('resource://gre/modules/Services.jsm');

const STRING_BUNDLE_URL = 'chrome://wotero/locale/wotero.properties';

let stringBundle: XPCOM.nsIStringBundle;

function getStringBundle(): XPCOM.nsIStringBundle {
  if (!stringBundle) {
    stringBundle = Services.strings.createBundle(STRING_BUNDLE_URL);
  }
  return stringBundle;
}

export default function getLocalizedString(name: WoteroPref | string): string {
  const fullName = name in WoteroPref ? `wotero.preferences.${name}` : name;
  return getStringBundle().GetStringFromName(fullName);
}
