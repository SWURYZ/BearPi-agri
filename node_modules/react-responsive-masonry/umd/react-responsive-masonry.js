/*!
 * react-responsive-masonry v2.7.1 - https://github.com/cedricdelpoux/react-responsive-masonry#readme
 * MIT Licensed
 */
(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory(require("react"), require("prop-types"));
	else if(typeof define === 'function' && define.amd)
		define(["react", "prop-types"], factory);
	else if(typeof exports === 'object')
		exports["ReactResponsiveMasonry"] = factory(require("react"), require("prop-types"));
	else
		root["ReactResponsiveMasonry"] = factory(root["React"], root["PropTypes"]);
})(window, function(__WEBPACK_EXTERNAL_MODULE__0__, __WEBPACK_EXTERNAL_MODULE__1__) {
return /******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, { enumerable: true, get: getter });
/******/ 		}
/******/ 	};
/******/
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = function(exports) {
/******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		}
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/
/******/ 	// create a fake namespace object
/******/ 	// mode & 1: value is a module id, require it
/******/ 	// mode & 2: merge all properties of value into the ns
/******/ 	// mode & 4: return value when already ns object
/******/ 	// mode & 8|1: behave like require
/******/ 	__webpack_require__.t = function(value, mode) {
/******/ 		if(mode & 1) value = __webpack_require__(value);
/******/ 		if(mode & 8) return value;
/******/ 		if((mode & 4) && typeof value === 'object' && value && value.__esModule) return value;
/******/ 		var ns = Object.create(null);
/******/ 		__webpack_require__.r(ns);
/******/ 		Object.defineProperty(ns, 'default', { enumerable: true, value: value });
/******/ 		if(mode & 2 && typeof value != 'string') for(var key in value) __webpack_require__.d(ns, key, function(key) { return value[key]; }.bind(null, key));
/******/ 		return ns;
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 2);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, exports) {

module.exports = __WEBPACK_EXTERNAL_MODULE__0__;

/***/ }),
/* 1 */
/***/ (function(module, exports) {

module.exports = __WEBPACK_EXTERNAL_MODULE__1__;

/***/ }),
/* 2 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(3);


/***/ }),
/* 3 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
// ESM COMPAT FLAG
__webpack_require__.r(__webpack_exports__);

// EXPORTS
__webpack_require__.d(__webpack_exports__, "ResponsiveMasonry", function() { return /* reexport */ ResponsiveMasonry; });

// EXTERNAL MODULE: external {"root":"PropTypes","commonjs2":"prop-types","commonjs":"prop-types","amd":"prop-types"}
var external_root_PropTypes_commonjs2_prop_types_commonjs_prop_types_amd_prop_types_ = __webpack_require__(1);
var external_root_PropTypes_commonjs2_prop_types_commonjs_prop_types_amd_prop_types_default = /*#__PURE__*/__webpack_require__.n(external_root_PropTypes_commonjs2_prop_types_commonjs_prop_types_amd_prop_types_);

// EXTERNAL MODULE: external {"root":"React","commonjs2":"react","commonjs":"react","amd":"react"}
var external_root_React_commonjs2_react_commonjs_react_amd_react_ = __webpack_require__(0);
var external_root_React_commonjs2_react_commonjs_react_amd_react_default = /*#__PURE__*/__webpack_require__.n(external_root_React_commonjs2_react_commonjs_react_amd_react_);

// CONCATENATED MODULE: ./src/Masonry/index.js
function _extends() { _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }

function _inheritsLoose(subClass, superClass) { subClass.prototype = Object.create(superClass.prototype); subClass.prototype.constructor = subClass; _setPrototypeOf(subClass, superClass); }

function _setPrototypeOf(o, p) { _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf(o, p); }




var Masonry_Masonry = /*#__PURE__*/function (_React$Component) {
  _inheritsLoose(Masonry, _React$Component);

  function Masonry() {
    var _this;

    _this = _React$Component.call(this) || this;
    _this.state = {
      columns: [],
      childRefs: [],
      hasDistributed: false
    };
    return _this;
  }

  var _proto = Masonry.prototype;

  _proto.componentDidUpdate = function componentDidUpdate() {
    if (!this.state.hasDistributed && !this.props.sequential) this.distributeChildren();
  };

  Masonry.getDerivedStateFromProps = function getDerivedStateFromProps(props, state) {
    var children = props.children,
        columnsCount = props.columnsCount;
    var hasColumnsChanged = columnsCount !== state.columns.length;
    if (state && children === state.children && !hasColumnsChanged) return null;
    return _extends({}, Masonry.getEqualCountColumns(children, columnsCount), {
      children: children,
      hasDistributed: false
    });
  };

  _proto.shouldComponentUpdate = function shouldComponentUpdate(nextProps) {
    return nextProps.children !== this.state.children || nextProps.columnsCount !== this.props.columnsCount;
  };

  _proto.distributeChildren = function distributeChildren() {
    var _this2 = this;

    var _this$props = this.props,
        children = _this$props.children,
        columnsCount = _this$props.columnsCount;
    var columnHeights = Array(columnsCount).fill(0);
    var isReady = this.state.childRefs.every(function (ref) {
      return ref.current.getBoundingClientRect().height;
    });
    if (!isReady) return;
    var columns = Array.from({
      length: columnsCount
    }, function () {
      return [];
    });
    var validIndex = 0;
    external_root_React_commonjs2_react_commonjs_react_amd_react_default.a.Children.forEach(children, function (child) {
      if (child && external_root_React_commonjs2_react_commonjs_react_amd_react_default.a.isValidElement(child)) {
        // .current is undefined if ref was passed to a functional component without forwardRef
        // now passing ref into a wrapper div so it should always be defined
        var childHeight = _this2.state.childRefs[validIndex].current.getBoundingClientRect().height;

        var minHeightColumnIndex = columnHeights.indexOf(Math.min.apply(Math, columnHeights));
        columnHeights[minHeightColumnIndex] += childHeight;
        columns[minHeightColumnIndex].push(child);
        validIndex++;
      }
    });
    this.setState(function (p) {
      return _extends({}, p, {
        columns: columns,
        hasDistributed: true
      });
    });
  };

  Masonry.getEqualCountColumns = function getEqualCountColumns(children, columnsCount) {
    var columns = Array.from({
      length: columnsCount
    }, function () {
      return [];
    });
    var validIndex = 0;
    var childRefs = [];
    external_root_React_commonjs2_react_commonjs_react_amd_react_default.a.Children.forEach(children, function (child) {
      if (child && external_root_React_commonjs2_react_commonjs_react_amd_react_default.a.isValidElement(child)) {
        var ref = external_root_React_commonjs2_react_commonjs_react_amd_react_default.a.createRef();
        childRefs.push(ref);
        columns[validIndex % columnsCount].push( /*#__PURE__*/external_root_React_commonjs2_react_commonjs_react_amd_react_default.a.createElement("div", {
          style: {
            display: "flex",
            justifyContent: "stretch"
          },
          key: validIndex,
          ref: ref
        }, child) // React.cloneElement(child, {ref}) // cannot attach refs to functional components without forwardRef
        );
        validIndex++;
      }
    });
    return {
      columns: columns,
      childRefs: childRefs
    };
  };

  _proto.renderColumns = function renderColumns() {
    var _this$props2 = this.props,
        gutter = _this$props2.gutter,
        itemTag = _this$props2.itemTag,
        itemStyle = _this$props2.itemStyle;
    return this.state.columns.map(function (column, i) {
      return external_root_React_commonjs2_react_commonjs_react_amd_react_default.a.createElement(itemTag, {
        key: i,
        style: _extends({
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-start",
          alignContent: "stretch",
          flex: 1,
          width: 0,
          gap: gutter
        }, itemStyle)
      }, column.map(function (item) {
        return item;
      }));
    });
  };

  _proto.render = function render() {
    var _this$props3 = this.props,
        gutter = _this$props3.gutter,
        className = _this$props3.className,
        style = _this$props3.style,
        containerTag = _this$props3.containerTag;
    return external_root_React_commonjs2_react_commonjs_react_amd_react_default.a.createElement(containerTag, {
      style: _extends({
        display: "flex",
        flexDirection: "row",
        justifyContent: "center",
        alignContent: "stretch",
        boxSizing: "border-box",
        width: "100%",
        gap: gutter
      }, style),
      className: className
    }, this.renderColumns());
  };

  return Masonry;
}(external_root_React_commonjs2_react_commonjs_react_amd_react_default.a.Component);

Masonry_Masonry.propTypes = {
  children: external_root_PropTypes_commonjs2_prop_types_commonjs_prop_types_amd_prop_types_default.a.oneOfType([external_root_PropTypes_commonjs2_prop_types_commonjs_prop_types_amd_prop_types_default.a.arrayOf(external_root_PropTypes_commonjs2_prop_types_commonjs_prop_types_amd_prop_types_default.a.node), external_root_PropTypes_commonjs2_prop_types_commonjs_prop_types_amd_prop_types_default.a.node]).isRequired,
  columnsCount: external_root_PropTypes_commonjs2_prop_types_commonjs_prop_types_amd_prop_types_default.a.number,
  gutter: external_root_PropTypes_commonjs2_prop_types_commonjs_prop_types_amd_prop_types_default.a.string,
  className: external_root_PropTypes_commonjs2_prop_types_commonjs_prop_types_amd_prop_types_default.a.string,
  style: external_root_PropTypes_commonjs2_prop_types_commonjs_prop_types_amd_prop_types_default.a.object,
  containerTag: external_root_PropTypes_commonjs2_prop_types_commonjs_prop_types_amd_prop_types_default.a.string,
  itemTag: external_root_PropTypes_commonjs2_prop_types_commonjs_prop_types_amd_prop_types_default.a.string,
  itemStyle: external_root_PropTypes_commonjs2_prop_types_commonjs_prop_types_amd_prop_types_default.a.object,
  sequential: external_root_PropTypes_commonjs2_prop_types_commonjs_prop_types_amd_prop_types_default.a.bool
};
Masonry_Masonry.defaultProps = {
  columnsCount: 3,
  gutter: "0",
  className: null,
  style: {},
  containerTag: "div",
  itemTag: "div",
  itemStyle: {},
  sequential: false
};
/* harmony default export */ var src_Masonry = (Masonry_Masonry);
// CONCATENATED MODULE: ./src/ResponsiveMasonry/index.js


var DEFAULT_COLUMNS_COUNT = 1;
var DEFAULT_GUTTER = "10px";
var useIsomorphicLayoutEffect = typeof window !== "undefined" ? external_root_React_commonjs2_react_commonjs_react_amd_react_["useLayoutEffect"] : external_root_React_commonjs2_react_commonjs_react_amd_react_["useEffect"];

var ResponsiveMasonry_useHasMounted = function useHasMounted() {
  var _useState = Object(external_root_React_commonjs2_react_commonjs_react_amd_react_["useState"])(false),
      hasMounted = _useState[0],
      setHasMounted = _useState[1];

  useIsomorphicLayoutEffect(function () {
    setHasMounted(true);
  }, []);
  return hasMounted;
};

var ResponsiveMasonry_useWindowWidth = function useWindowWidth() {
  var hasMounted = ResponsiveMasonry_useHasMounted();

  var _useState2 = Object(external_root_React_commonjs2_react_commonjs_react_amd_react_["useState"])(typeof window !== "undefined" ? window.innerWidth : 0),
      width = _useState2[0],
      setWidth = _useState2[1];

  var handleResize = Object(external_root_React_commonjs2_react_commonjs_react_amd_react_["useCallback"])(function () {
    if (!hasMounted) return;
    setWidth(window.innerWidth);
  }, [hasMounted]);
  useIsomorphicLayoutEffect(function () {
    if (hasMounted) {
      window.addEventListener("resize", handleResize);
      handleResize();
      return function () {
        return window.removeEventListener("resize", handleResize);
      };
    }
  }, [hasMounted, handleResize]);
  return width;
};

var ResponsiveMasonry_MasonryResponsive = function MasonryResponsive(_ref) {
  var _ref$columnsCountBrea = _ref.columnsCountBreakPoints,
      columnsCountBreakPoints = _ref$columnsCountBrea === void 0 ? {
    350: 1,
    750: 2,
    900: 3
  } : _ref$columnsCountBrea,
      _ref$gutterBreakPoint = _ref.gutterBreakPoints,
      gutterBreakPoints = _ref$gutterBreakPoint === void 0 ? {} : _ref$gutterBreakPoint,
      children = _ref.children,
      _ref$className = _ref.className,
      className = _ref$className === void 0 ? null : _ref$className,
      _ref$style = _ref.style,
      style = _ref$style === void 0 ? null : _ref$style;
  var windowWidth = ResponsiveMasonry_useWindowWidth();
  var getResponsiveValue = Object(external_root_React_commonjs2_react_commonjs_react_amd_react_["useCallback"])(function (breakPoints, defaultValue) {
    var sortedBreakPoints = Object.keys(breakPoints).sort(function (a, b) {
      return a - b;
    });
    var value = sortedBreakPoints.length > 0 ? breakPoints[sortedBreakPoints[0]] : defaultValue;
    sortedBreakPoints.forEach(function (breakPoint) {
      if (breakPoint < windowWidth) {
        value = breakPoints[breakPoint];
      }
    });
    return value;
  }, [windowWidth]);
  var columnsCount = Object(external_root_React_commonjs2_react_commonjs_react_amd_react_["useMemo"])(function () {
    return getResponsiveValue(columnsCountBreakPoints, DEFAULT_COLUMNS_COUNT);
  }, [getResponsiveValue, columnsCountBreakPoints]);
  var gutter = Object(external_root_React_commonjs2_react_commonjs_react_amd_react_["useMemo"])(function () {
    return getResponsiveValue(gutterBreakPoints, DEFAULT_GUTTER);
  }, [getResponsiveValue, gutterBreakPoints]);
  return /*#__PURE__*/external_root_React_commonjs2_react_commonjs_react_amd_react_default.a.createElement("div", {
    className: className,
    style: style
  }, external_root_React_commonjs2_react_commonjs_react_amd_react_default.a.Children.map(children, function (child, index) {
    return external_root_React_commonjs2_react_commonjs_react_amd_react_default.a.cloneElement(child, {
      key: index,
      columnsCount: columnsCount,
      gutter: gutter
    });
  }));
};

ResponsiveMasonry_MasonryResponsive.propTypes = {
  children: external_root_PropTypes_commonjs2_prop_types_commonjs_prop_types_amd_prop_types_default.a.oneOfType([external_root_PropTypes_commonjs2_prop_types_commonjs_prop_types_amd_prop_types_default.a.arrayOf(external_root_PropTypes_commonjs2_prop_types_commonjs_prop_types_amd_prop_types_default.a.node), external_root_PropTypes_commonjs2_prop_types_commonjs_prop_types_amd_prop_types_default.a.node]).isRequired,
  columnsCountBreakPoints: external_root_PropTypes_commonjs2_prop_types_commonjs_prop_types_amd_prop_types_default.a.object,
  className: external_root_PropTypes_commonjs2_prop_types_commonjs_prop_types_amd_prop_types_default.a.string,
  style: external_root_PropTypes_commonjs2_prop_types_commonjs_prop_types_amd_prop_types_default.a.object
};
/* harmony default export */ var ResponsiveMasonry = (ResponsiveMasonry_MasonryResponsive);
// CONCATENATED MODULE: ./src/index.js


/* harmony default export */ var src = __webpack_exports__["default"] = (src_Masonry);


/***/ })
/******/ ])["default"];
});