"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;

var _react = _interopRequireWildcard(require("react"));

var _propTypes = _interopRequireDefault(require("prop-types"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function _getRequireWildcardCache(nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }

function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

var DEFAULT_COLUMNS_COUNT = 1;
var DEFAULT_GUTTER = "10px";
var useIsomorphicLayoutEffect = typeof window !== "undefined" ? _react.useLayoutEffect : _react.useEffect;

var useHasMounted = function useHasMounted() {
  var _useState = (0, _react.useState)(false),
      hasMounted = _useState[0],
      setHasMounted = _useState[1];

  useIsomorphicLayoutEffect(function () {
    setHasMounted(true);
  }, []);
  return hasMounted;
};

var useWindowWidth = function useWindowWidth() {
  var hasMounted = useHasMounted();

  var _useState2 = (0, _react.useState)(typeof window !== "undefined" ? window.innerWidth : 0),
      width = _useState2[0],
      setWidth = _useState2[1];

  var handleResize = (0, _react.useCallback)(function () {
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

var MasonryResponsive = function MasonryResponsive(_ref) {
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
  var windowWidth = useWindowWidth();
  var getResponsiveValue = (0, _react.useCallback)(function (breakPoints, defaultValue) {
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
  var columnsCount = (0, _react.useMemo)(function () {
    return getResponsiveValue(columnsCountBreakPoints, DEFAULT_COLUMNS_COUNT);
  }, [getResponsiveValue, columnsCountBreakPoints]);
  var gutter = (0, _react.useMemo)(function () {
    return getResponsiveValue(gutterBreakPoints, DEFAULT_GUTTER);
  }, [getResponsiveValue, gutterBreakPoints]);
  return /*#__PURE__*/_react["default"].createElement("div", {
    className: className,
    style: style
  }, _react["default"].Children.map(children, function (child, index) {
    return _react["default"].cloneElement(child, {
      key: index,
      columnsCount: columnsCount,
      gutter: gutter
    });
  }));
};

MasonryResponsive.propTypes = process.env.NODE_ENV !== "production" ? {
  children: _propTypes["default"].oneOfType([_propTypes["default"].arrayOf(_propTypes["default"].node), _propTypes["default"].node]).isRequired,
  columnsCountBreakPoints: _propTypes["default"].object,
  className: _propTypes["default"].string,
  style: _propTypes["default"].object
} : {};
var _default = MasonryResponsive;
exports["default"] = _default;
module.exports = exports.default;