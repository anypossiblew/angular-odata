import { Enums } from '../utils';
import { Parser, JsonSchemaExpandOptions, EnumConfig } from '../types';

import { ODataParser } from './base';

export class ODataEnumParser<Type> extends ODataParser<Type> {
  flags?: boolean;
  members: { [name: string]: number } | { [value: number]: string };

  constructor(meta: EnumConfig<Type>, namespace: string) {
    super(meta.name, `${namespace}.${meta.name}`);
    this.flags = meta.flags;
    this.members = meta.members;
  }

  // Deserialize
  deserialize(value: any): Partial<Type> | Partial<Type>[] {
    // string | string[] -> number | number[]
    // TODO: stringAsEnum
    if (this.flags) {
      return Enums.toValues(this.members, value) as any;
    } else {
      return Enums.toValue(this.members, value) as any;
    }
  }

  // Serialize
  serialize(value: Partial<Type> | Partial<Type>[]): any {
    // number | number[] -> string | string[]
    if (this.flags) {
      const names = Enums.toNames(this.members, value);
      return this.stringAsEnum ? names : names.map(name => `${this.type}'${name}'`);
    } else {
      const name = Enums.toName(this.members, value);
      return this.stringAsEnum ? name : `${this.type}'${name}'`;
    }
  }

  // Json Schema
  toJsonSchema(options: JsonSchemaExpandOptions<Type> = {}) {
    let property = <any>{
      title: `The ${this.name} field`,
      type: "string"
    };
    property.enum = Enums.names(this.members);
    return property;
  }
}
