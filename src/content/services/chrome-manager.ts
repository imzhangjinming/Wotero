import type { PluginInfo, Service } from './service';

export default class ChromeManager implements Service {
  private chromeHandle?: XPCOM.nsIJSRAIIHelper;

  public startup({ rootURI }: PluginInfo) {
    const aomStartup = Cc[
      '@mozilla.org/addons/addon-manager-startup;1'
    ].getService(Ci.amIAddonManagerStartup);

    const manifestURI = Services.io.newURI(rootURI + 'manifest.json');

    this.chromeHandle = aomStartup.registerChrome(manifestURI, [
      ['content', 'wotero', 'content/'],
      ['locale', 'wotero', 'en-US', 'locale/en-US/'],
      ['locale', 'wotero', 'zh-CN', 'locale/zh-CN/'],
    ]);
  }

  public shutdown() {
    if (this.chromeHandle) {
      this.chromeHandle.destruct();
      delete this.chromeHandle;
    }
  }
}
