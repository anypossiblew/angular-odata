import { Enums } from '../utils';
import { JsonSchemaExpandOptions, EnumConfig, ODataOptions, Parser } from '../types';

export class ODataEnumParser<Type> implements Parser<Type> {
  name: string;
  type: string;
  flags?: boolean;
  members: { [name: string]: number } | { [value: number]: string };

  constructor(meta: EnumConfig<Type>, namespace: string) {
    this.name = meta.name;
    //this.type = `${namespace}.${meta.name}`;
    this.flags = meta.flags;
    this.members = meta.members;
  }

  // Deserialize
  deserialize(value: string, options: ODataOptions): Type {
    // string -> Type 
    if (this.flags) {
      return Enums.toValues(this.members, value).reduce((acc, v) => acc | v, 0) as any;
    } else {
      return Enums.toValue(this.members, value) as any;
    }
  }

  // Serialize
  serialize(value: Type, options: ODataOptions): string {
    // Type -> string 
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
