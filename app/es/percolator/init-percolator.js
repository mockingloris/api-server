const utils = require('../utils');

/*
  This module adds new queries for a program to ES.
  Queries must be processed before 'coming' here, this processing includes:
    * generating a guid for each query
    * ensuring queries are well formed
    * deduplicating queries... done on client side but double checked here
*/
exports.modules = {
  addQueries
};

// the query structure in our app is different than the query structure used
// by ES. Need to convert between the two.
function AppQueryESqueryConverter(applicationQuery) {
  // could use a filter. Most likely negligible improvement for our small dataset
  const convertedQuery = {
    query: {
      bool: {
        must: [ ]
      }
    }
  };
  // build our query from the conditions associate with the program
  convertedQuery.query.bool.must = applicationQuery.conditions.reduce( (accum, condition) => {
    switch(condition.type) {
      case 'number': {
        if( condition.qualifier === undefined) {
          throw new Error('condition type number with qualifier undefined');
        }
        const numberCondition = parseNumberCondition(condition);
        return [numberCondition, ...accum];
      }
      case 'boolean': {
        const boolCondition = parseBooleanCondition(condition);
        return [boolCondition, ...accum];
      }
      default: {
        return accum;
      }
    }
  }, []);
  return convertedQuery;
}

function parseNumberCondition(condition) {
  if (condition.qualifier === undefined) {
    throw new Error('conditon qualifier undefined');
  } else if (condition.qualifier === 'equal') {
    const obj = {
      term: {}
    };
    obj.term[condition.key.name] = condition.value;
    return obj;
  } else {
    // have to call a more complex function to deal with < "less than",
    // >= "greater than or equal" etc. cases
    return parseQualifiedNumberCondition(condition);
  }
}

function parseQualifiedNumberCondition(condition) {
  const obj = {
    range: {

    }
  };
  obj.condition.range[condition.key.name];
  // return statements are 'hidden' in these cases
  switch(condition.qualifier) {
    case 'lessThan': {
      obj.condition.range[condition.key.name] = {
        lt: condition.value
      };
      return obj;
    }
    case 'lessThanOrEqual': {
      obj.condition.range[condition.key.name] = {
        lte: condition.value
      };
      return obj;
    }
    case 'greaterThanOrEqual': {
      obj.condition.range[condition.key.name] = {
        gte: condition.value
      };
      return obj;
    }
    case 'greaterThan': {
      obj.condition.range[condition.key.name] = {
        gt: condition.value
      };
      return obj;
    }
    default: {
      throw new Error(`number condition without qualifier key: ${condition.key.name}, value: ${condition.key.value}`);
    }
  }
}

function parseBooleanCondition(condition) {
  const obj = {
    term: {}
  };
  obj.term[condition.key.name] = condition.value;
  return obj;
}

async function addQueries(client, queries) {
  const promises = queries.reduce( (accum, query) => {
    const convertedQuery = AppQueryESqueryConverter(query);
    // must update the id prior to reaching here
    const promise = utils.addPercolator(client, query.id, convertedQuery);
    return [promise, ...accum];
  }, []);
  const response = await Promise.all(promises);
  return response;
}