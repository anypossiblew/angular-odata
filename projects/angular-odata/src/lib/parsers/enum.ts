import { Enums } from '../utils';
import { JsonSchemaExpandOptions, EnumConfig, ParseOptions, Parser } from '../types';

export class ODataEnumParser<Type> implements Parser<Type> {
  name: string;
  type: string;
  flags?: boolean;
  members: { [name: string]: number } | { [value: number]: string };

  constructor(meta: EnumConfig<Type>, namespace: string) {
    this.name = meta.name;
    this.type = `${namespace}.${meta.name}`;
    this.flags = meta.flags;
    this.members = meta.members;
  }

  // Deserialize
  deserialize(value: any, options: ParseOptions): Partial<Type> | Partial<Type>[] {
    // string | string[] -> number 
    if (this.flags) {
      return Enums.toValues(this.members, value).reduce((acc, v) => acc | v, 0) as any;
    } else {
      return Enums.toValue(this.members, value) as any;
    }
  }

  // Serialize
  serialize(value: Partial<Type> | Partial<Type>[], options: ParseOptions): any {
    // number | number[] -> string 
    if (this.flags) {
      let names = Enums.toNames(this.members, value);
      if (!options.stringAsEnum)
        names = names.map(name => `${this.type}'${name}'`)
      return names.join(", ");
    } else {
      let name = Enums.toName(this.members, value);
      if (!options.stringAsEnum)
        name = `${this.type}'${name}'`;
      return name;
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
