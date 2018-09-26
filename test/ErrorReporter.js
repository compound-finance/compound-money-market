"use strict";

/*
 * This module loads enum Error and enum FailureInfo from ErrorReporter.sol.
 * The goal is to build objects like `ErrorEnum = { NO_ERROR: 0, OPAQUE_ERROR: 1, ... };
 * We form these objects by a simple regex parse of `ErrorReporter.sol`.
 */

const fs = require('fs');
const path = require('path');

const errorReporterPath = path.join(__dirname, '..', 'contracts', 'ErrorReporter.sol');
const contents = fs.readFileSync(errorReporterPath, 'utf8').toString();

function invert(object) {
  return Object.entries(object).reduce((obj, [key, value]) => ({ ...obj, [value]: key }), {});
}

function getEnum(solidity, name) {
  const enumRegex = new RegExp('enum\\s+' + name + '\\s*{([^}]+)}', 'm'); // Enum { ... }
  const commentStripRegex = /(\/\/[^\n]+\n)|(\/\*[^\*]\*\/)/g; // Removes // to newline, or /* inner */
  const splitterRegex = /[\s,]+/g; // Splits on commas and spaces

  const enumEl = enumRegex.exec(solidity);

  if (!enumEl) {
    throw ("Unable to find enum " + name);
  }

  const enumInner = enumEl[1]; // The inside of the enum
  const enumInnerLessComments = enumInner.replace(commentStripRegex, ''); // Remove comments
  const enumElements = enumInnerLessComments.split(splitterRegex);

  // Filter blank elements
  const elements = enumElements.filter((x) => x.length > 0);

  // Convert list to object
  const result = {};
  let i = 0;

  elements.forEach((el) => {
    result[el] = i++;
  });

  return result;
};

const ErrorEnum = getEnum(contents, "Error");
const FailureInfoEnum = getEnum(contents, "FailureInfo");

const ErrorEnumInv = invert(ErrorEnum);
const FailureInfoEnumInv = invert(FailureInfoEnum);

module.exports = {
  ErrorEnum,
  ErrorEnumInv,
  FailureInfoEnum,
  FailureInfoEnumInv
};
