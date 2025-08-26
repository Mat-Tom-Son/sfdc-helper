'use strict';

// Read-only allowlist for objects and their fields that the chatbot can access.
// Includes per-field allowed operators and default field sets.
// Now enhanced with dynamic discovery from context bundles.

let dynamicAllowlist = null;
try {
  dynamicAllowlist = require('./dynamicAllowlist');
} catch (_) {
  // Dynamic allowlist not available, use static only
}

const DEFAULT_MAX_LIMIT = 200;

// Allowed operators per field. If omitted, defaults to equality only.
// Common safe ops: '=', '!=', 'LIKE', 'IN', 'NOT IN', '>', '>=', '<', '<='
const OBJECTS = {
  Account: {
    fields: [
      'Id',
      'Name',
      'Owner.Id',
      'Owner.Name',
      'CreatedDate',
      'LastModifiedDate',
      'Industry',
      'Type',
      'BillingCity',
      'BillingState',
    ],
    defaultFields: ['Id', 'Name', 'Owner.Name', 'CreatedDate'],
    operators: {
      'Id': ['=', 'IN', 'NOT IN'],
      'Name': ['=', '!=', 'LIKE', 'IN', 'NOT IN'],
      'Owner.Id': ['=', 'IN'],
      'Owner.Name': ['LIKE', '='],
      'Industry': ['=', 'IN', 'NOT IN'],
      'Type': ['=', 'IN', 'NOT IN'],
      'CreatedDate': ['>', '>=', '<', '<='],
      'LastModifiedDate': ['>', '>=', '<', '<='],
      'BillingCity': ['=', 'LIKE'],
      'BillingState': ['=', 'LIKE'],
    },
  },
  Contact: {
    fields: [
      'Id',
      'FirstName',
      'LastName',
      'Email',
      'Phone',
      'Owner.Id',
      'Owner.Name',
      'Account.Id',
      'Account.Name',
      'CreatedDate',
    ],
    defaultFields: ['Id', 'FirstName', 'LastName', 'Email'],
    operators: {
      'Id': ['=', 'IN', 'NOT IN'],
      'FirstName': ['=', 'LIKE'],
      'LastName': ['=', 'LIKE'],
      'Email': ['=', 'LIKE'],
      'Phone': ['=', 'LIKE'],
      'Owner.Id': ['=', 'IN'],
      'Account.Id': ['=', 'IN'],
      'CreatedDate': ['>', '>=', '<', '<='],
    },
  },
  Opportunity: {
    fields: [
      'Id',
      'Name',
      'StageName',
      'Amount',
      'CloseDate',
      'IsClosed',
      'IsWon',
      'CurrencyIsoCode',
      'RecordType.DeveloperName',
      'RecordTypeId',
      'Owner.Id',
      'Owner.Name',
      'Owner.Alias',
      'Account.Id',
      'Account.Name',
      'CreatedDate',
      'LastModifiedDate',
      'LastModifiedBy.Id',
      'LastModifiedBy.Name',
      'LastModifiedBy.Alias',
      'LastModifiedById',
      'SystemModstamp',
      'LastActivityDate',
      'OpportunityScore.Score',
      'OpportunityScore.Id',
      'OpportunityScoreId',
      'Description',
      'Type',
      'LeadSource',
      'ForecastCategory',
      'ForecastCategoryName',
      'Probability',
      'ExpectedRevenue',
      'TotalOpportunityQuantity',
      'NextStep',
      'HasOpportunityLineItem',
      'Pricebook2Id',
      'Contact.Id',
      'Contact.Name',
      'ContactId',
    ],
    defaultFields: ['Id', 'Name', 'StageName', 'Amount', 'CloseDate', 'IsClosed', 'CurrencyIsoCode', 'RecordType.DeveloperName'],
    operators: {
      'Id': ['=', 'IN', 'NOT IN'],
      'Name': ['=', 'LIKE'],
      'StageName': ['=', 'IN', 'NOT IN'],
      'Amount': ['=', '>', '>=', '<', '<='],
      'CloseDate': ['>', '>=', '<', '<=', '='],
      'IsClosed': ['=', '!='],
      'IsWon': ['=', '!='],
      'CurrencyIsoCode': ['=', 'IN', 'NOT IN'],
      'RecordType.DeveloperName': ['=', 'IN', 'NOT IN'],
      'RecordTypeId': ['=', 'IN', 'NOT IN'],
      'Owner.Id': ['=', 'IN'],
      'Owner.Alias': ['=', 'LIKE'],
      'Account.Id': ['=', 'IN'],
      'Contact.Id': ['=', 'IN'],
      'ContactId': ['=', 'IN'],
      'CreatedDate': ['>', '>=', '<', '<=', '='],
      'LastModifiedDate': ['>', '>=', '<', '<=', '='],
      'LastModifiedById': ['=', 'IN'],
      'SystemModstamp': ['>', '>=', '<', '<='],
      'LastActivityDate': ['>', '>=', '<', '<=', '='],
      'Description': ['=', 'LIKE'],
      'Type': ['=', 'IN', 'NOT IN'],
      'LeadSource': ['=', 'IN', 'NOT IN'],
      'ForecastCategory': ['=', 'IN', 'NOT IN'],
      'Probability': ['=', '>', '>=', '<', '<='],
      'ExpectedRevenue': ['=', '>', '>=', '<', '<='],
      'TotalOpportunityQuantity': ['=', '>', '>=', '<', '<='],
      'NextStep': ['=', 'LIKE'],
      'HasOpportunityLineItem': ['=', '!='],
      'Pricebook2Id': ['=', 'IN'],
    },
  },
  Lead: {
    fields: [
      'Id',
      'FirstName',
      'LastName',
      'Company',
      'Email',
      'Phone',
      'Status',
      'LeadSource',
      'Industry',
      'Rating',
      'Owner.Id',
      'Owner.Name',
      'CreatedDate',
      'LastModifiedDate',
      'ConvertedDate',
      'IsConverted',
      'ConvertedAccountId',
      'ConvertedContactId',
      'ConvertedOpportunityId',
    ],
    defaultFields: ['Id', 'FirstName', 'LastName', 'Company', 'Email', 'Status'],
    operators: {
      'Id': ['=', 'IN', 'NOT IN'],
      'FirstName': ['=', 'LIKE'],
      'LastName': ['=', 'LIKE'],
      'Company': ['=', 'LIKE'],
      'Email': ['=', 'LIKE'],
      'Phone': ['=', 'LIKE'],
      'Status': ['=', 'IN', 'NOT IN'],
      'LeadSource': ['=', 'IN', 'NOT IN'],
      'Industry': ['=', 'IN', 'NOT IN'],
      'Rating': ['=', 'IN', 'NOT IN'],
      'Owner.Id': ['=', 'IN'],
      'CreatedDate': ['>', '>=', '<', '<='],
      'LastModifiedDate': ['>', '>=', '<', '<='],
      'ConvertedDate': ['>', '>=', '<', '<='],
      'IsConverted': ['=', '!='],
      'ConvertedAccountId': ['=', 'IN'],
      'ConvertedContactId': ['=', 'IN'],
      'ConvertedOpportunityId': ['=', 'IN'],
    },
  },
  Case: {
    fields: [
      'Id',
      'CaseNumber',
      'Subject',
      'Description',
      'Status',
      'Priority',
      'Type',
      'Reason',
      'Origin',
      'IsClosed',
      'IsEscalated',
      'Owner.Id',
      'Owner.Name',
      'Account.Id',
      'Account.Name',
      'Contact.Id',
      'Contact.Name',
      'CreatedDate',
      'LastModifiedDate',
      'ClosedDate',
    ],
    defaultFields: ['Id', 'CaseNumber', 'Subject', 'Status', 'Priority', 'Owner.Name'],
    operators: {
      'Id': ['=', 'IN', 'NOT IN'],
      'CaseNumber': ['=', 'LIKE'],
      'Subject': ['=', 'LIKE'],
      'Status': ['=', 'IN', 'NOT IN'],
      'Priority': ['=', 'IN', 'NOT IN'],
      'Type': ['=', 'IN', 'NOT IN'],
      'Reason': ['=', 'IN', 'NOT IN'],
      'Origin': ['=', 'IN', 'NOT IN'],
      'IsClosed': ['=', '!='],
      'IsEscalated': ['=', '!='],
      'Owner.Id': ['=', 'IN'],
      'Account.Id': ['=', 'IN'],
      'Contact.Id': ['=', 'IN'],
      'CreatedDate': ['>', '>=', '<', '<='],
      'LastModifiedDate': ['>', '>=', '<', '<='],
      'ClosedDate': ['>', '>=', '<', '<='],
    },
  },
  Task: {
    fields: [
      'Id',
      'Subject',
      'Description',
      'Status',
      'Priority',
      'ActivityDate',
      'IsClosed',
      'IsHighPriority',
      'Owner.Id',
      'Owner.Name',
      'Who.Id',
      'Who.Name',
      'What.Id',
      'What.Name',
      'Account.Id',
      'Account.Name',
      'CreatedDate',
      'LastModifiedDate',
    ],
    defaultFields: ['Id', 'Subject', 'Status', 'Priority', 'ActivityDate', 'Owner.Name'],
    operators: {
      'Id': ['=', 'IN', 'NOT IN'],
      'Subject': ['=', 'LIKE'],
      'Status': ['=', 'IN', 'NOT IN'],
      'Priority': ['=', 'IN', 'NOT IN'],
      'ActivityDate': ['>', '>=', '<', '<='],
      'IsClosed': ['=', '!='],
      'IsHighPriority': ['=', '!='],
      'Owner.Id': ['=', 'IN'],
      'Who.Id': ['=', 'IN'],
      'What.Id': ['=', 'IN'],
      'Account.Id': ['=', 'IN'],
      'CreatedDate': ['>', '>=', '<', '<='],
      'LastModifiedDate': ['>', '>=', '<', '<='],
    },
  },
  Event: {
    fields: [
      'Id',
      'Subject',
      'Description',
      'Location',
      'StartDateTime',
      'EndDateTime',
      'DurationInMinutes',
      'ActivityDateTime',
      'IsAllDayEvent',
      'Owner.Id',
      'Owner.Name',
      'Who.Id',
      'Who.Name',
      'What.Id',
      'What.Name',
      'Account.Id',
      'Account.Name',
      'CreatedDate',
      'LastModifiedDate',
    ],
    defaultFields: ['Id', 'Subject', 'StartDateTime', 'EndDateTime', 'Owner.Name'],
    operators: {
      'Id': ['=', 'IN', 'NOT IN'],
      'Subject': ['=', 'LIKE'],
      'Location': ['=', 'LIKE'],
      'StartDateTime': ['>', '>=', '<', '<='],
      'EndDateTime': ['>', '>=', '<', '<='],
      'ActivityDateTime': ['>', '>=', '<', '<='],
      'IsAllDayEvent': ['=', '!='],
      'Owner.Id': ['=', 'IN'],
      'Who.Id': ['=', 'IN'],
      'What.Id': ['=', 'IN'],
      'Account.Id': ['=', 'IN'],
      'CreatedDate': ['>', '>=', '<', '<='],
      'LastModifiedDate': ['>', '>=', '<', '<='],
    },
  },
  User: {
    fields: [
      'Id',
      'Username',
      'FirstName',
      'LastName',
      'Name',
      'Email',
      'IsActive',
      'UserRole.Name',
      'Profile.Name',
      'Title',
      'Department',
      'Division',
      'Phone',
      'MobilePhone',
      'CreatedDate',
      'LastModifiedDate',
      'LastLoginDate',
    ],
    defaultFields: ['Id', 'Name', 'Email', 'IsActive', 'UserRole.Name', 'Profile.Name'],
    operators: {
      'Id': ['=', 'IN', 'NOT IN'],
      'Username': ['=', 'LIKE'],
      'FirstName': ['=', 'LIKE'],
      'LastName': ['=', 'LIKE'],
      'Name': ['=', 'LIKE'],
      'Email': ['=', 'LIKE'],
      'IsActive': ['=', '!='],
      'Title': ['=', 'LIKE'],
      'Department': ['=', 'IN', 'NOT IN'],
      'Division': ['=', 'IN', 'NOT IN'],
      'Phone': ['=', 'LIKE'],
      'MobilePhone': ['=', 'LIKE'],
      'CreatedDate': ['>', '>=', '<', '<='],
      'LastModifiedDate': ['>', '>=', '<', '<='],
      'LastLoginDate': ['>', '>=', '<', '<='],
    },
  },
};

function isObjectAllowed(objectName) {
  const staticAllowed = !!OBJECTS[objectName];
  const dynamicAllowed = dynamicAllowlist ? dynamicAllowlist.isDynamicObjectAllowed(objectName) : false;
  return staticAllowed || dynamicAllowed;
}

function getAllowedFields(objectName) {
  const spec = OBJECTS[objectName];
  const staticFields = spec ? spec.fields : [];
  
  // Use dynamic allowlist if available, otherwise fall back to static
  if (dynamicAllowlist) {
    try {
      return dynamicAllowlist.getDynamicAllowedFields(objectName, staticFields);
    } catch (_) {}
  }
  return staticFields;
}

function getDefaultFields(objectName) {
  const spec = OBJECTS[objectName];
  return spec && Array.isArray(spec.defaultFields) ? spec.defaultFields : [];
}

function isOperatorAllowed(objectName, field, op) {
  const spec = OBJECTS[objectName];
  const staticOps = (spec && spec.operators && spec.operators[field]) || ['='];
  
  // Use dynamic allowlist if available, otherwise fall back to static
  if (dynamicAllowlist) {
    try {
      const ops = dynamicAllowlist.getDynamicAllowedOperators(objectName, field, staticOps);
      return ops.includes(String(op).toUpperCase());
    } catch (_) {}
  }
  return staticOps.includes(String(op).toUpperCase());
}

function filterAllowedFields(objectName, requestedFields) {
  const allowed = new Set(getAllowedFields(objectName));
  const list = Array.isArray(requestedFields) ? requestedFields : [];
  return list.filter((f) => allowed.has(f));
}

function clampLimit(limit) {
  const n = Number.parseInt(limit, 10);
  if (!Number.isFinite(n) || n <= 0) return 50;
  return Math.min(n, DEFAULT_MAX_LIMIT);
}

module.exports = {
  OBJECTS,
  isObjectAllowed,
  getAllowedFields,
  getDefaultFields,
  isOperatorAllowed,
  filterAllowedFields,
  clampLimit,
  DEFAULT_MAX_LIMIT,
};


