/**
 * TypeScript definitions for SFDC Helper
 * 
 * Provides comprehensive type safety for the org-aware Salesforce API layer
 */

export interface SFDCHelperClientOptions {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

export interface HealthResponse {
  status: 'ok';
}

export interface OrgIdentity {
  id: string;
  organization_id: string;
  display_name: string;
  username: string;
  user_id: string;
  nick_name: string;
  email: string;
  first_name: string;
  last_name: string;
  timezone: string;
  photos: {
    picture: string;
    thumbnail: string;
  };
  addr_street: string;
  addr_city: string;
  addr_state: string;
  addr_country: string;
  addr_zip: string;
  mobile_phone: string;
  mobile_phone_verified: boolean;
  status: {
    created_date: string;
    body: string;
  };
  urls: {
    enterprise: string;
    metadata: string;
    partner: string;
    rest: string;
    sobjects: string;
    search: string;
    query: string;
    recent: string;
    tooling_soap: string;
    tooling_rest: string;
    profile: string;
    feeds: string;
    groups: string;
    users: string;
    feed_items: string;
  };
  active: boolean;
  user_type: string;
  language: string;
  locale: string;
  utcOffset: number;
  last_modified_date: string;
  is_lightning_login_user: boolean;
}

export interface OrgLimits {
  [key: string]: {
    Max: number;
    Remaining: number;
  };
}

export interface OrgInfo {
  identity: OrgIdentity;
  limits: OrgLimits;
}

export interface AllowlistObjectSpec {
  fields: string[];
  defaultFields?: string[];
  operators?: Record<string, string[]>;
}

export interface Allowlist {
  [objectName: string]: AllowlistObjectSpec;
}

export interface AllowlistStats {
  dynamic: boolean;
  message?: string;
  stats?: Record<string, {
    staticFields: number;
    discoveredFields: number;
    totalFields: number;
  }>;
}

export interface WhereCondition {
  field: string;
  op: '=' | '!=' | 'LIKE' | 'IN' | 'NOT IN' | '>' | '>=' | '<' | '<=';
  value: any;
}

export interface OrderBy {
  field: string;
  direction: 'ASC' | 'DESC';
}

export interface SafeQueryOptions {
  fields?: string[];
  where?: WhereCondition[];
  orderBy?: OrderBy;
  limit?: number;
  flatten?: boolean;
  format?: 'json' | 'ndjson' | 'csv';
}

export interface QueryOptions {
  limit?: number;
  next?: string;
}

export interface SalesforceRecord {
  attributes: {
    type: string;
    url: string;
  };
  Id: string;
  [key: string]: any;
}

export interface QueryResult {
  totalSize: number;
  done: boolean;
  next?: string;
  records: SalesforceRecord[];
}

export interface SearchResult {
  searchRecords: Array<{
    attributes: {
      type: string;
      url: string;
    };
    Id: string;
    [key: string]: any;
  }>;
}

export interface FieldDescription {
  aggregatable: boolean;
  aiPredictionField: boolean;
  autoNumber: boolean;
  byteLength: number;
  calculated: boolean;
  calculatedFormula?: string;
  cascadeDelete: boolean;
  caseSensitive: boolean;
  compoundFieldName?: string;
  controllerName?: string;
  createable: boolean;
  custom: boolean;
  defaultValue?: any;
  defaultValueFormula?: string;
  defaultedOnCreate: boolean;
  dependentPicklist: boolean;
  deprecatedAndHidden: boolean;
  digits: number;
  displayLocationInDecimal: boolean;
  encrypted: boolean;
  externalId: boolean;
  extraTypeInfo?: string;
  filterable: boolean;
  filteredLookupInfo?: any;
  formulaTreatNullNumberAsZero: boolean;
  groupable: boolean;
  highScaleNumber: boolean;
  htmlFormatted: boolean;
  idLookup: boolean;
  inlineHelpText?: string;
  label: string;
  length: number;
  mask?: string;
  maskType?: string;
  name: string;
  nameField: boolean;
  namePointing: boolean;
  nillable: boolean;
  permissionable: boolean;
  picklistValues: Array<{
    active: boolean;
    defaultValue: boolean;
    label: string;
    validFor?: string;
    value: string;
  }>;
  polymorphicForeignKey: boolean;
  precision: number;
  queryByDistance: boolean;
  referenceTargetField?: string;
  referenceTo: string[];
  relationshipName?: string;
  relationshipOrder?: number;
  restrictedDelete: boolean;
  restrictedPicklist: boolean;
  scale: number;
  searchPrefilterable: boolean;
  soapType: string;
  sortable: boolean;
  type: string;
  unique: boolean;
  updateable: boolean;
  writeRequiresMasterRead: boolean;
}

export interface ObjectDescription {
  activateable: boolean;
  associateEntityType?: string;
  associateParentEntity?: string;
  createable: boolean;
  custom: boolean;
  customSetting: boolean;
  deepCloneable: boolean;
  deletable: boolean;
  deprecatedAndHidden: boolean;
  feedEnabled: boolean;
  hasSubtypes: boolean;
  isInterface: boolean;
  isSubtype: boolean;
  keyPrefix: string;
  label: string;
  labelPlural: string;
  layoutable: boolean;
  listviewable?: boolean;
  lookupLayoutable?: boolean;
  mergeable: boolean;
  mruEnabled: boolean;
  name: string;
  queryable: boolean;
  replicateable: boolean;
  retrieveable: boolean;
  searchLayoutable: boolean;
  searchable: boolean;
  triggerable: boolean;
  undeletable: boolean;
  updateable: boolean;
  urls: {
    compactLayouts: string;
    rowTemplate: string;
    approvalLayouts: string;
    uiDetailTemplate: string;
    uiEditTemplate: string;
    defaultValues: string;
    listviews: string;
    describe: string;
    quickActions: string;
    layouts: string;
    sobject: string;
  };
  fields: FieldDescription[];
  childRelationships: any[];
  recordTypeInfos: Array<{
    available: boolean;
    defaultRecordTypeMapping: boolean;
    developerName: string;
    master: boolean;
    name: string;
    recordTypeId: string;
    urls: {
      layout: string;
    };
  }>;
}

export interface PicklistField {
  field: string;
  values: Array<{
    value: string;
    label: string;
    active: boolean;
  }>;
}

export interface ObjectInsightsSummary {
  objectName: string;
  label: string;
  labelPlural: string;
  keyPrefix: string;
  queryable: boolean;
  searchable: boolean;
  fieldCount: number;
  allowlisted: boolean;
  defaultFields: string[];
}

export interface QuerySuggestion {
  title: string;
  description?: string;
  where: WhereCondition[];
  limit?: number;
}

export interface ObjectInsights {
  summary: ObjectInsightsSummary;
  sample?: {
    query: string;
    fields: string[];
    records: SalesforceRecord[];
  };
  picklists: PicklistField[];
  recent: {
    totalSize: number;
    records: SalesforceRecord[];
  };
  topFields: Array<{
    field: string;
    count: number;
    percentage: number;
  }>;
  recordTypes: Array<{
    name: string;
    developerName: string;
    recordTypeId: string;
    default: boolean;
    active: boolean;
  }>;
  layouts: Array<{
    id: string;
    name: string;
  }>;
  suggestions: QuerySuggestion[];
}

export interface ContextBundleOptions {
  persist?: boolean;
  dir?: string;
  runQueries?: boolean;
  sample?: number;
  verbose?: boolean;
}

export interface ContextBundleResult {
  ok: boolean;
  dir?: string;
  files?: string[];
}

export interface SmartQuery {
  intent: string;
  suggestion: QuerySuggestion | null;
  query: SafeQueryOptions & { object: string };
}

export interface SmartQueryResult extends SmartQuery {
  results: QueryResult;
}

export interface AnalyticsTopField {
  field: string;
  count: number;
  percentage: number;
}

export interface AnalyticsRecentQuery {
  timestamp: string;
  kind: 'soql' | 'safe-query' | 'search';
  objectName?: string;
  fields?: string[];
  soql?: string;
  resultCount: number;
}

export declare class SFDCHelperClient {
  readonly baseUrl: string;
  readonly options: Required<SFDCHelperClientOptions>;

  constructor(baseUrl?: string, options?: SFDCHelperClientOptions);

  // Health and org info
  health(): Promise<HealthResponse>;
  getOrgInfo(): Promise<OrgInfo>;

  // Allowlist management
  getAllowlist(refresh?: boolean): Promise<Allowlist>;
  getAllowlistStats(): Promise<AllowlistStats>;
  refreshAllowlist(): Promise<{ message: string; stats: AllowlistStats['stats'] }>;
  getAvailableFields(objectName: string): Promise<string[]>;
  getDefaultFields(objectName: string): Promise<string[]>;

  // Schema discovery
  describeObject(objectName: string, refresh?: boolean): Promise<ObjectDescription>;
  getPicklists(objectName: string, refresh?: boolean): Promise<PicklistField[]>;

  // Data access
  safeQuery(objectName: string, options?: SafeQueryOptions): Promise<QueryResult>;
  query(soql: string, options?: QueryOptions): Promise<QueryResult>;
  search(sosl: string): Promise<SearchResult>;
  getRecentRecords(objectName: string, limit?: number): Promise<QueryResult>;
  getChanges(objectName: string, since: string | Date, limit?: number): Promise<QueryResult>;

  // Advanced features
  getObjectInsights(objectName: string, options?: { verbose?: boolean }): Promise<ObjectInsights>;
  generateContextBundle(objectName: string, options?: ContextBundleOptions): Promise<ContextBundleResult>;

  // Smart querying
  buildSmartQuery(objectName: string, intent: string, options?: Partial<SafeQueryOptions>): Promise<SmartQuery>;
  executeSmartQuery(objectName: string, intent: string, options?: Partial<SafeQueryOptions>): Promise<SmartQueryResult>;

  // Analytics
  getTopFields(objectName: string, top?: number): Promise<AnalyticsTopField[]>;
  getRecentQueries(limit?: number): Promise<AnalyticsRecentQuery[]>;

  // Cache management
  clearCache(): void;
}

// Utility types
export interface AllowlistUtils {
  OBJECTS: Record<string, AllowlistObjectSpec>;
  getAllowedFields(objectName: string): string[];
  isObjectAllowed(objectName: string): boolean;
}

export interface Utils {
  generateObjectInsights(objectName: string, options?: { verbose?: boolean }): Promise<ObjectInsights>;
  buildSafeSoql(options: SafeQueryOptions & { object: string }): { soql: string };
}

// Main package exports
export interface SFDCHelperPackage {
  SFDCHelperClient: typeof SFDCHelperClient;
  Client: typeof SFDCHelperClient;
  default: typeof SFDCHelperClient;
  allowlist: AllowlistUtils;
  utils: Utils;
  server: any; // Express app - keeping as any to avoid Express dependencies
}

// Default export
declare const sfdcHelper: SFDCHelperPackage;
export default sfdcHelper;

// Named exports
export { SFDCHelperClient as Client };
export const allowlist: AllowlistUtils;
export const utils: Utils;
export const server: any;
