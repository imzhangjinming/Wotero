import 'core-js/stable/object/from-entries';

import { log } from './utils';
import WoteroItem from './wotero-item';

export type wolaiTitleBuilder = (item: WoteroItem) => string | Promise<string>;

const TEXT_CONTENT_MAX_LENGTH = 2000;

export default class Wolai {
  // private readonly client: Client;
  private readonly databaseID: string;
  private readonly authToken: string;
  private _databaseProperties?: string[];

  static APP_URL_PROTOCOL = '';

  static TAG_NAME = 'wolai';

  static PAGE_URL_REGEX = new RegExp(
    `^${Wolai.APP_URL_PROTOCOL}.+([0-9a-f]{32})$`
  );

  static buildRichText(content: string | null): string {
    if (!content) return '';

    return Wolai.truncateTextToMaxLength(content);
  }

  static convertWebURLToAppURL(url: string): string {
    return this.APP_URL_PROTOCOL + url;
  }

  static getPageIDFromURL(url: string): string | undefined {
    const matches = url.match(this.PAGE_URL_REGEX);
    return matches ? matches[1] : undefined;
  }

  static sanitizeSelectOption(text: string): string {
    return text.replace(/,/g, ';');
  }

  static truncateTextToMaxLength(text: string): string {
    return text.substr(0, TEXT_CONTENT_MAX_LENGTH);
  }

  public constructor(authToken: string, databaseID: string) {
    this.authToken = authToken;
    this.databaseID = databaseID;
  }

  private async getDatabaseProperties(): Promise<string[]> {
    if (!this._databaseProperties) {
      const databaseResponse = await this.getDatabaseResponse();
      log(
        '==========================================================================='
      );
      const content = JSON.parse(databaseResponse.response);
      log(typeof databaseResponse.response);
      log(typeof content);
      log(content);
      log(content['data']['column_order']);
      log(typeof content['data']['column_order']);
      log(
        '==========================================================================='
      );
      this._databaseProperties = content['data']['column_order'] as string[];
    }
    return this._databaseProperties;
  }

  private async getDatabaseResponse(): Promise<any> {
    try {
      const response = await Zotero.HTTP.request(
        'GET',
        'https://openapi.wolai.com/v1/databases/' + this.databaseID,
        {
          headers: { Authorization: this.authToken },
        }
      );
      // log('===========================================================================')
      // log(JSON.parse(JSON.stringify(response.response)));
      // log('===========================================================================')

      return response;
    } catch (error) {
      log(error, 'error');
      throw error;
    }
  }

  public async saveItemToDatabase(
    item: WoteroItem,
    buildTitle: wolaiTitleBuilder
  ): Promise<string> {
    const pageID = item.getWolaiPageID();
    const properties = await this.buildItemProperties(item, buildTitle);

    if (pageID) {
      // wolai 暂时没有发布更新数据表格中指定行的API
    }

    let data = JSON.stringify({
      rows: [properties],
    });

    log('---------data-----------');
    log(data);
    // log(this.authToken);

    let url =
      'https://openapi.wolai.com/v1/databases/' + this.databaseID + '/rows';
    //'https://openapi.wolai.com/v1/databases/{id}/rows';

    try {
      const response = await Zotero.HTTP.request('POST', url, {
        body: data,
        headers: {
          Authorization: this.authToken,
          'User-Agent': 'Apifox/1.0.0 (https://apifox.com)',
          'Content-Type': 'application/json',
        },
      });
      log(
        '==========================================================================='
      );
      const content = JSON.parse(response.response);
      log(typeof response.response);
      log(typeof content);
      log(content);
      log(content['data']);
      log(typeof content['data']);
      log(
        '==========================================================================='
      );

      // new page url
      return content['data'];
    } catch (error) {
      log(error, 'error');
      log('type of error ------->');
      log(typeof error);
      log('error meaaage ------->');
      log(JSON.stringify(error));
      throw error;
    }
  }

  private async buildItemProperties(
    item: WoteroItem,
    buildTitle: wolaiTitleBuilder
  ): Promise<any> {
    type Definition = {
      name: string;
      buildRequest: () => string | null | Promise<string> | undefined;
    };

    const databaseProperties = await this.getDatabaseProperties();

    const databaseHasProperty = ({ name }: Definition) =>
      databaseProperties.includes(name);

    interface Properties {
      [key: string]: any;
    }

    const itemProperties: Properties = {
      Name: Wolai.buildRichText(await buildTitle(item)),
    };

    const propertyDefinitions: Definition[] = [
      {
        name: 'Abstract',
        buildRequest: () => Wolai.buildRichText(item.getAbstract()),
      },
      {
        name: 'Authors',
        buildRequest: () => Wolai.buildRichText(item.getAuthors().join('\n')),
      },
      // {
      //   name: 'Collections',
      //   buildRequest: () =>
      //     item.getCollections().map((collection) => ({
      //       name: Wolai.sanitizeSelectOption(collection),
      //     })),
      // },
      {
        name: 'Date',
        buildRequest: () => Wolai.buildRichText(item.getDate()),
      },
      {
        name: 'DOI',
        buildRequest: () => item.getDOI(),
      },
      {
        name: 'Editors',
        buildRequest: () => Wolai.buildRichText(item.getEditors().join('\n')),
      },
      {
        name: 'File Path',
        buildRequest: async () => Wolai.buildRichText(await item.getFilePath()),
      },
      {
        name: 'Full Citation',
        buildRequest: async () =>
          Wolai.buildRichText(
            (await item.getFullCitation()) || item.getTitle()
          ),
      },
      {
        name: 'In-Text Citation',
        buildRequest: async () =>
          Wolai.buildRichText(
            (await item.getInTextCitation()) || item.getTitle()
          ),
      },
      {
        name: 'Item Type',
        buildRequest: () => item.getItemType(),
      },
      {
        name: 'Short Title',
        buildRequest: () => Wolai.buildRichText(item.getShortTitle()),
      },
      // {
      //   name: 'Tags',
      //   type: 'multi_select',
      //   buildRequest: () =>
      //     item.getTags().map((tag) => ({
      //       name: Wolai.sanitizeSelectOption(tag),
      //     })),
      // },
      {
        name: 'Title',
        buildRequest: () => Wolai.buildRichText(item.getTitle()),
      },
      {
        name: 'URL',
        buildRequest: () => item.getURL(),
      },
      {
        name: 'Year',
        buildRequest: () => item.getYear()?.toString(),
      },
      {
        name: 'Zotero URI',
        buildRequest: () => item.getZoteroURI(),
      },
    ];

    // for (const { name, buildRequest } of propertyDefinitions) {
    //   const request = await buildRequest();
    //   itemProperties[name] = request;
    // }
    // log('===========================================================================')
    // log(typeof itemProperties);
    // log(JSON.stringify(itemProperties))
    // log('===========================================================================')

    const validPropertyDefinitions =
      propertyDefinitions.filter(databaseHasProperty);

    for (const { name, buildRequest } of validPropertyDefinitions) {
      const request = await buildRequest();
      itemProperties[name] = request;
    }
    // log(
    //   '==========================================================================='
    // );
    // log(typeof itemProperties);
    // log(JSON.stringify(itemProperties));
    // log(
    //   '==========================================================================='
    // );

    return itemProperties;
  }
}
