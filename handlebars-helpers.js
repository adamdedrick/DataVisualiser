const moment = require('moment');

let helpersInitialized = false;

function initHandlebarsHelpers(Handlebars) {
  if (!Handlebars || typeof Handlebars.registerHelper !== 'function') {
    throw new Error('A valid Handlebars instance is required to initialize helpers.');
  }

  if (helpersInitialized) {
    return;
  }

  Handlebars.registerHelper('firstChar', function(str) {
    if (str && typeof str === 'string') {
      const firstCharacter = str.charAt(0);
      return firstCharacter;
    }
    return '';
  });

  Handlebars.registerHelper('blankIfZero', function(val) {
    return (val === 0 || val === '0' || val === null || val === undefined) ? '' : val;
  });

  Handlebars.registerHelper('blankIfZero2', function(val, prefix, suffix) {
    if (val === 0 || val === '0' || val === null || val === undefined) {
      return '';
    }

    const suffixText = typeof suffix === 'string' ? suffix : '';
    const prefixText = typeof prefix === 'string' ? prefix : '';
    return `${prefixText}${val}${suffixText}`;
  });

  Handlebars.registerHelper('dims', function(...args) {
    // Last arg is the Handlebars options object, exclude it.
    const vals = args.slice(0, -1);
    const filteredValues = vals.filter(v => v !== 0 && v !== '0' && v !== null && v !== undefined && v !== '');
    const dimsText = filteredValues.join('/');
    return dimsText;
  });

  Handlebars.registerHelper('now', function(format) {
    const fmt = typeof format === 'string' ? format : 'YYYY-MM-DD';
    const timestamp = moment().format(fmt);
    const safeTimestamp = new Handlebars.SafeString(timestamp);
    return safeTimestamp;
  });

  helpersInitialized = true;
}

module.exports = { initHandlebarsHelpers };
