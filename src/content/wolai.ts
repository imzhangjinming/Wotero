// import {
//     // APIErrorCode,
//     // APIResponseError,
//     // Client,
//     Logger,
//     LogLevel,
//   } from '@notionhq/client';
//   import {
//     CreatePageParameters,
//     CreatePageResponse,
//     GetDatabaseResponse,
//     UpdatePageResponse,
//   } from '@notionhq/client/build/src/api-endpoints';
import 'core-js/stable/object/from-entries';

import NoteroItem from './notero-item';
import WoteroItem from './wotero-item';
import { log } from './utils';
// import { request, RequestResult } from './request';
// import { XMLHttpRequest } from 'xmlhttprequest-ts';
// import fetch from 'node-fetch';
// import { AxiosError, AxiosResponse } from 'axios';
// import axios from 'axios';

//   type CreateDatabasePageParameters = Extract<
//     CreatePageParameters,
//     {
//       parent: {
//         database_id: string;
//       };
//     }
//   >;

//   type DatabasePageProperties = CreateDatabasePageParameters['properties'];

//   type DatabaseProperties = GetDatabaseResponse['properties'];

//   type DatabasePageProperty = Extract<
//     DatabasePageProperties[string],
//     { type?: string }
//   >;

//   type PropertyType = NonNullable<DatabasePageProperty['type']>;

//   type PropertyRequest<T extends PropertyType> = Extract<
//     DatabasePageProperty,
//     { [P in T]: unknown }
//   >[T];

export type wolaiTitleBuilder = (item: WoteroItem) => string | Promise<string>;

const TEXT_CONTENT_MAX_LENGTH = 2000;

export default class Wolai {
  // private readonly client: Client;
  private readonly databaseID: string;
  private readonly authToken: string;
  private _databaseProperties?: string[];

  static APP_URL_PROTOCOL = 'wolai:';

  static PAGE_URL_REGEX = new RegExp(
    `^${Wolai.APP_URL_PROTOCOL}.+([0-9a-f]{32})$`
  );

  // static logger: Logger = (level, message, extraInfo) => {
  //   log(
  //     `${message} - ${JSON.stringify(extraInfo)}`,
  //     level === LogLevel.ERROR ? 'error' : 'warning'
  //   );
  // };

  static buildRichText(content: string | null): string {
    if (!content) return '';

    return Wolai.truncateTextToMaxLength(content);
  }

  static convertWebURLToAppURL(url: string): string {
    //   return url.replace(/^https:/, this.APP_URL_PROTOCOL);
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
    //   this.client = new Client({
    //     auth: authToken,
    //     logger: Notion.logger,
    //   });
    this.authToken = authToken;
    this.databaseID = databaseID;
  }

  private async getDatabaseProperties(): Promise<string[]> {
    if (!this._databaseProperties) {
      // const database = await this.client.databases.retrieve({
      //   database_id: this.databaseID,
      // });
      // this._databaseProperties = database.properties;
      const databaseResponse = await this.getDatabaseResponse();
      // const content = await databaseResponse.json();
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
      // const response = await fetch('https://openapi.wolai.com/v1/databases/' + this.databaseID, {
      //   method: "GET",
      //   headers: {Authorization: this.authToken}
      // })

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

      // let _databaseProperties = response.data.data.column_order;
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

    let url =
      'https://openapi.wolai.com/v1/databases/' + this.databaseID + '/rows';

    try {
      const response = await Zotero.HTTP.request('POST', url, {
        body: data,
        headers: { Authorization: this.authToken },
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
      title: Wolai.buildRichText(await buildTitle(item)),
    };

    // {
    //   title: {
    //     title: Wolai.buildRichText(await buildTitle(item)),
    //   },
    // };

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
    log(
      '==========================================================================='
    );
    log(typeof itemProperties);
    log(JSON.stringify(itemProperties));
    log(
      '==========================================================================='
    );

    return itemProperties;
  }
}
