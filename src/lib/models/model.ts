import { Observable, NEVER } from 'rxjs';
import { map } from 'rxjs/operators';

import { ODataEntityResource, Expand, ODataPropertyResource, ODataEntityAnnotations, ODataFunctionResource, ODataActionResource, ODataResource, ODataAnnotations, Select, ODataValueAnnotations, ODataEntitiesAnnotations } from '../resources';

import { ODataCollection } from './collection';
import { ODataNavigationPropertyResource } from '../resources/requests/navigationproperty';
import { HttpOptions, HttpEntityOptions, HttpValueOptions } from '../resources/http-options';
import { entityAttributes, odataAnnotations } from '../types';
import { ODataCallableResource } from '../resources/requests/callable';
import { ODataField } from './parser';

export class ODataModel<T> {
  private _resource: ODataResource<T>;
  private _entity: T;
  private _annotations: ODataAnnotations | null;
  private _relationships: { [name: string]: ODataModel<any> | ODataCollection<any, ODataModel<any>> }

  constructor(resource: ODataResource<T>, entity?: Partial<T>, annots?: ODataAnnotations) {
    this._resource = resource;
    this._resource.meta().fields()
      .filter(field => field.navigation)
      .forEach(field => {
        Object.defineProperty(this, field.name, {
          get() {
            return this.getNavigationProperty(field.name);
          },
          set(model: ODataModel<any> | null) {
            return this.setNavigationProperty(field.name, model);
          }
        });
      });
    this.populate((entity || {}) as T, annots || null);
  }

  attach(resource: ODataResource<T>) {
    if (this._resource.type() !== resource.type())
      throw new Error(`Can't reattach ${resource.type()} with ${this._resource.type()}`);
    this._resource = resource;
    return this;
  }

  target() {
    return this._resource.clone() as ODataResource<T>;
  }

  private related<R>(resource: ODataResource<R>, f: ODataField<any>) {
    let value = this._entity[f.name];
    if (f.collection) {
      return resource.toCollection(value || []);
    } else {
      value = value || {};
      return resource.toModel(value || {});
    }
  }

  private populate(entity: T, annots?: ODataAnnotations | null) {
    this._entity = entity;
    this._annotations = annots;
    this._relationships = {};
    let fields = this._resource.meta().fields();
    let entries = Object.entries(entity)
      .map(([key, value]) => [key, value, fields.find(f => f.name === key)]);
      //Attributes
    let attrs = entries
      .filter(([,, f]) => f && !f.navigation)
      .reduce((acc, [k, v]) => Object.assign(acc, {[k]: v}), {});
    //console.log(attrs);
    Object.assign(this, attrs);
      //Others
    let others = entries
      .filter(([,, f]) => !f)
      .reduce((acc, [k, v]) => Object.assign(acc, {[k]: v}), {});
    //console.log(others);
    Object.assign(this, others);
      //Complexes
    let complexes = entries
      .filter(([,, f]) => f && !f.navigation && f.parser)
      .reduce((acc, [k,, f]) => {
        let prop = (this._resource as ODataEntityResource<T>).property(f.name);
        let complex = this.related(prop, f);
        return Object.assign(acc, {[k]: complex});
      } , {});
    //console.log(complexes);
    Object.assign(this, complexes);
    return this;
  }

  toEntity() : T {
    let entity = {} as T;
    this._resource.meta().fields().forEach(field => {
      if (field.parser) {
        if (field.navigation) {
          if (field.name in this._relationships) {
            let rel = this._relationships[field.name];
            entity[field.name] = (rel instanceof ODataModel)? rel.toEntity() : rel.toEntities();
          }
        } else if (this[field.name] !== undefined) {
          let complex = this[field.name];
          entity[field.name] = (complex instanceof ODataModel)? complex.toEntity() : complex.toEntities();
        }
      } else if (this[field.name] !== undefined) {
        entity[field.name] = this[field.name];
      }
    });
    return entity;
  }

  clone() {
    let Ctor = <typeof ODataModel>this.constructor;
    return (new Ctor(this._resource.clone(), this.toEntity(), this._annotations)) as ODataModel<T>;
  }

  fetch(options?: HttpOptions): Observable<this | null> {
    let opts = <HttpEntityOptions & HttpValueOptions>{
      headers: options && options.headers,
      params: options && options.params,
      reportProgress: options && options.reportProgress,
      withCredentials: options && options.withCredentials
    }
    let obs$: Observable<any>;
    if (this._resource instanceof ODataEntityResource) {
      this._resource.key(this);
      if (!this._resource.hasKey())
        throw new Error(`Can't fetch entity without key`);
      obs$ = this._resource.get(opts);
    } else if (this._resource instanceof ODataNavigationPropertyResource) {
      obs$ = this._resource.get(Object.assign(opts, { responseType: 'entity' }));
    } else if (this._resource instanceof ODataPropertyResource) {
      obs$ = this._resource.get(Object.assign(opts, { responseType: 'value' }));
    } else if (this._resource instanceof ODataFunctionResource) {
      obs$ = this._resource.get(Object.assign(opts, { responseType: 'entity' }));
    }
    if (!obs$)
      throw new Error("Not Yet!");
    return obs$.pipe(
      map(([entity, annots]) => entity ? this.populate(entity, annots) : null));
  }

  create(options?: HttpOptions): Observable<this> {
    let opts = <HttpEntityOptions & HttpValueOptions>{
      headers: options && options.headers,
      params: options && options.params,
      reportProgress: options && options.reportProgress,
      withCredentials: options && options.withCredentials
    }
    if (this._resource instanceof ODataEntityResource) {
      return this._resource.post(this.toEntity(), opts).pipe(map(([entity, annots]) => this.populate(entity, annots)));
    }
    throw new Error(`Can't create`);
  }

  update(options?: HttpOptions): Observable<this> {
    let opts = <HttpEntityOptions & HttpValueOptions>{
      headers: options && options.headers,
      params: options && options.params,
      reportProgress: options && options.reportProgress,
      withCredentials: options && options.withCredentials
    }
    if (this._resource instanceof ODataEntityResource) {
      this._resource.key(this);
      if (!this._resource.hasKey()) 
        throw new Error(`Can't update entity without key`);
      let etag = (this._annotations && this._annotations instanceof ODataEntityAnnotations) ? this._annotations.etag : undefined;
      return this._resource.put(this.toEntity(), Object.assign(opts, {etag})).pipe(map(([entity, annots]) => this.populate(entity, annots)));
    }
    throw new Error(`Can't update`);
  }
  
  save(options?: HttpOptions): Observable<this> {
    if (this._resource instanceof ODataEntityResource) {
      this._resource.key(this);
      return this._resource.hasKey() ? this.update(options) : this.create(options);
    }
    throw new Error(`Can't save`);
  }

  destroy(options?: HttpOptions): Observable<null> {
    let opts = <HttpEntityOptions & HttpValueOptions>{
      headers: options && options.headers,
      params: options && options.params,
      reportProgress: options && options.reportProgress,
      withCredentials: options && options.withCredentials
    }
    if (this._resource instanceof ODataEntityResource) {
      this._resource.key(this);
      if (!this._resource.hasKey())
        throw new Error(`Can't destroy entity without key`);
      let etag = (this._annotations && this._annotations instanceof ODataEntityAnnotations) ? this._annotations.etag : undefined;
      return this._resource.delete(Object.assign(opts, { etag }));
    }
    throw new Error(`Can't destroy`);
  }

  // Callable
  protected call<R>(
    callable: ODataCallableResource<R>, 
    args: any | null, 
    responseType: 'value', 
    options?: HttpOptions
  ): Observable<R>;

  protected call<R, M extends ODataModel<R>>(
    callable: ODataCallableResource<R>, 
    args: any | null, 
    responseType: 'model', 
    options?: HttpOptions
  ): Observable<M>;

  protected call<R, M extends ODataModel<R>, C extends ODataCollection<R, M>>(
    callable: ODataCallableResource<R>, 
    args: any | null, 
    responseType: 'collection', 
    options?: HttpOptions
  ): Observable<C>;

  protected call<R>(
    callable: ODataCallableResource<R>, 
    args: any | null, 
    responseType: 'value' | 'model' | 'collection', 
    options?: HttpOptions
  ): Observable<any> {
    let res$ = callable.call(args, 'json', options);
    switch (responseType) {
      case 'value':
        return res$.pipe(map((body: any) => callable.toValue(body)[0]));
      case 'model':
        return res$.pipe(map((body: any) => callable.toModel<ODataModel<any>>(body)));
      case 'collection':
        return res$.pipe(map((body: any) => callable.toCollection<ODataCollection<any, ODataModel<any>>>(body)));
    }
  }

  // Functions
  protected function<R>(name: string, returnType?: string): ODataFunctionResource<R> {
    if (this._resource instanceof ODataEntityResource) {
      this._resource.key(this);
      if (!this._resource.hasKey()) 
        throw new Error(`Can't function without key`);
      return this._resource.function<R>(name, returnType);
    }
    throw new Error(`Can't function without EntityResource`);
  }

  // Actions
  protected action<R>(name: string, returnType?: string): ODataActionResource<R> {
    if (this._resource instanceof ODataEntityResource) {
      this._resource.key(this);
      if (!this._resource.hasKey()) 
        throw new Error(`Can't action without key`);
      return this._resource.action<R>(name, returnType);
    }
    throw new Error(`Can't action without EntityResource`);
  }

  // Navigation Properties === References
  protected navigationProperty<P>(name: string): ODataNavigationPropertyResource<P> {
    if (this._resource instanceof ODataEntityResource) {
      this._resource.key(this);
      if (!this._resource.hasKey()) 
        throw new Error(`Can't navigation without key`);
      return this._resource.navigationProperty<P>(name);
    }
    throw new Error(`Can't navigation without EntityResource`);
  }

  protected getNavigationProperty<P>(name: string): ODataModel<P> | ODataCollection<P, ODataModel<P>> {
    let field = this._resource.meta().fields().find(f => f.name === name);
    if (!(name in this._relationships)) {
      let nav = this.navigationProperty<P>(field.name);
      this._relationships[field.name] = this.related(nav, field);
    }
    return this._relationships[field.name];
  }

  protected setNavigationProperty<P, Pm extends ODataModel<P>>(name: string, model: Pm | null): Observable<this> {
    let field = this._resource.meta().fields().find(f => f.name === name);
    if (field.collection)
      throw new Error(`Can't set ${field.name} to collection, use add`);
    let ref = this.navigationProperty<P>(name).reference();
    let etag = (this._annotations as ODataEntityAnnotations).etag;
    // TODO: change the resource of a model 
    delete this._relationships[field.name];
    if (model instanceof ODataModel) {
      return ref.set(model._resource as ODataEntityResource<P>, { etag });
    } else if (model === null)
      return ref.remove({etag});
  }

  // Query options
  get _query() {
    let resource = this._resource as ODataEntityResource<T>;
    return {
      select(select?: Select<T>) { return resource.select(select); },
      expand(expand?: Expand<T>) { return resource.expand(expand); },
    }
  }
}
