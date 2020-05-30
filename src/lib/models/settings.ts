import { HttpErrorResponse } from "@angular/common/http";
import { Observable } from "rxjs";
import { ODataModel } from './model';
import { ODataCollection } from './collection';
import { Config } from '../types';
import { ODataEntityConfig, ODataEnumConfig, ODataSchema, ODataServiceConfig } from './config';
import { ODataParser } from '../parsers';
import { Types } from '../utils';

export class ODataSettings {
  serviceRootUrl: string;
  params: { [param: string]: string | string[] };
  metadataUrl?: string;
  withCredentials?: boolean;
  acceptMetadata?: 'minimal' | 'full' | 'none';
  creation?: Date;
  version?: string;
  stringAsEnum?: boolean;
  schemas?: Array<ODataSchema>;
  errorHandler?: (error: HttpErrorResponse) => Observable<never>;

  constructor(config: Config) {
    this.serviceRootUrl = config.serviceRootUrl;
    if (this.serviceRootUrl.indexOf('?') != -1)
      throw new Error("The 'serviceRootUrl' should not contain query string. Please use 'params' to add extra parameters");
    if (!this.serviceRootUrl.endsWith('/'))
      this.serviceRootUrl += '/';
    this.params = config.params || {};
    this.metadataUrl = `${config.serviceRootUrl}$metadata`;
    this.withCredentials = config.withCredentials || false;
    this.acceptMetadata = config.acceptMetadata;
    this.stringAsEnum = config.stringAsEnum || false;
    this.creation = config.creation || new Date();
    this.errorHandler = config.errorHandler || null;

    this.schemas = config.schemas.map(schema => new ODataSchema(schema));

    this.schemas.forEach(schema => schema.configure({
      stringAsEnum: this.stringAsEnum, 
      parserForType: (type: string) => this.parserForType(type)
    }));
  }

  public schemaForType(type: string) {
    let schema = this.schemas.find(s => type.startsWith(s.namespace));
    if (schema)
      return schema;
  }

  public enumConfigForType<T>(type: string) {
    let schema = this.schemaForType(type);
    if (schema)
      return schema.enums.find(e => e.type === type) as ODataEnumConfig<T>;
  }

  public entityConfigForType<T>(type: string) {
    let schema = this.schemaForType(type);
    if (schema)
      return schema.entities.find(e => e.type === type) as ODataEntityConfig<T>;
  }

  public serviceConfigForType(type: string) {
    /*
    let schema = this.schemaForType(type);
    if (schema)
      return schema.containers.find(e => e.type === type) as ODataServiceConfig;
      */
    return null;
  }

  public modelForType(type: string): typeof ODataModel {
    let config = this.entityConfigForType(type);
    if (!Types.isUndefined(config))
      return config.model as typeof ODataModel;
  }

  public collectionForType(type: string): typeof ODataCollection {
    let config = this.entityConfigForType(type);
    if (!Types.isUndefined(config))
      return config.collection as typeof ODataCollection;
  }

  public parserForType<T>(type: string): ODataParser<T> {
    let config = this.enumConfigForType(type) || this.entityConfigForType(type);
    if (!Types.isUndefined(config))
      return config.parser as ODataParser<T>;
  }
}