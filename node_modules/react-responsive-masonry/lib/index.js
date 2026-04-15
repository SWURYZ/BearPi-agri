"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "ResponsiveMasonry", {
  enumerable: true,
  get: function get() {
    return _ResponsiveMasonry["default"];
  }
});
exports["default"] = void 0;

var _Masonry = _interopRequireDefault(require("./Masonry"));

var _ResponsiveMasonry = _interopRequireDefault(require("./ResponsiveMasonry"));

exports.ResponsiveMasonry = _ResponsiveMasonry["default"];

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var _default = _Masonry["default"];
exports["default"] = _default;