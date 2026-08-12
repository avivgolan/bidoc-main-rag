//#region \0rolldown/runtime.js
var e = Object.create, t = Object.defineProperty, n = Object.getOwnPropertyDescriptor, r = Object.getOwnPropertyNames, i = Object.getPrototypeOf, a = Object.prototype.hasOwnProperty, o = (e, t) => () => (t || (e((t = { exports: {} }).exports, t), e = null), t.exports), s = (e, i, o, s) => {
	if (i && typeof i == "object" || typeof i == "function") for (var c = r(i), l = 0, u = c.length, d; l < u; l++) d = c[l], !a.call(e, d) && d !== o && t(e, d, {
		get: ((e) => i[e]).bind(null, d),
		enumerable: !(s = n(i, d)) || s.enumerable
	});
	return e;
}, c = (n, r, a) => (a = n == null ? {} : e(i(n)), s(r || !n || !n.__esModule ? t(a, "default", {
	value: n,
	enumerable: !0
}) : a, n)), l = /* @__PURE__ */ o(((e) => {
	var t = Symbol.for("react.transitional.element"), n = Symbol.for("react.portal"), r = Symbol.for("react.fragment"), i = Symbol.for("react.strict_mode"), a = Symbol.for("react.profiler"), o = Symbol.for("react.consumer"), s = Symbol.for("react.context"), c = Symbol.for("react.forward_ref"), l = Symbol.for("react.suspense"), u = Symbol.for("react.memo"), d = Symbol.for("react.lazy"), f = Symbol.for("react.activity"), p = Symbol.iterator;
	function m(e) {
		return typeof e != "object" || !e ? null : (e = p && e[p] || e["@@iterator"], typeof e == "function" ? e : null);
	}
	var h = {
		isMounted: function() {
			return !1;
		},
		enqueueForceUpdate: function() {},
		enqueueReplaceState: function() {},
		enqueueSetState: function() {}
	}, g = Object.assign, _ = {};
	function v(e, t, n) {
		this.props = e, this.context = t, this.refs = _, this.updater = n || h;
	}
	v.prototype.isReactComponent = {}, v.prototype.setState = function(e, t) {
		if (typeof e != "object" && typeof e != "function" && e != null) throw Error("takes an object of state variables to update or a function which returns an object of state variables.");
		this.updater.enqueueSetState(this, e, t, "setState");
	}, v.prototype.forceUpdate = function(e) {
		this.updater.enqueueForceUpdate(this, e, "forceUpdate");
	};
	function y() {}
	y.prototype = v.prototype;
	function b(e, t, n) {
		this.props = e, this.context = t, this.refs = _, this.updater = n || h;
	}
	var x = b.prototype = new y();
	x.constructor = b, g(x, v.prototype), x.isPureReactComponent = !0;
	var S = Array.isArray;
	function C() {}
	var w = {
		H: null,
		A: null,
		T: null,
		S: null
	}, T = Object.prototype.hasOwnProperty;
	function E(e, n, r) {
		var i = r.ref;
		return {
			$$typeof: t,
			type: e,
			key: n,
			ref: i === void 0 ? null : i,
			props: r
		};
	}
	function ee(e, t) {
		return E(e.type, t, e.props);
	}
	function D(e) {
		return typeof e == "object" && !!e && e.$$typeof === t;
	}
	function te(e) {
		var t = {
			"=": "=0",
			":": "=2"
		};
		return "$" + e.replace(/[=:]/g, function(e) {
			return t[e];
		});
	}
	var O = /\/+/g;
	function k(e, t) {
		return typeof e == "object" && e && e.key != null ? te("" + e.key) : t.toString(36);
	}
	function A(e) {
		switch (e.status) {
			case "fulfilled": return e.value;
			case "rejected": throw e.reason;
			default: switch (typeof e.status == "string" ? e.then(C, C) : (e.status = "pending", e.then(function(t) {
				e.status === "pending" && (e.status = "fulfilled", e.value = t);
			}, function(t) {
				e.status === "pending" && (e.status = "rejected", e.reason = t);
			})), e.status) {
				case "fulfilled": return e.value;
				case "rejected": throw e.reason;
			}
		}
		throw e;
	}
	function j(e, r, i, a, o) {
		var s = typeof e;
		(s === "undefined" || s === "boolean") && (e = null);
		var c = !1;
		if (e === null) c = !0;
		else switch (s) {
			case "bigint":
			case "string":
			case "number":
				c = !0;
				break;
			case "object": switch (e.$$typeof) {
				case t:
				case n:
					c = !0;
					break;
				case d: return c = e._init, j(c(e._payload), r, i, a, o);
			}
		}
		if (c) return o = o(e), c = a === "" ? "." + k(e, 0) : a, S(o) ? (i = "", c != null && (i = c.replace(O, "$&/") + "/"), j(o, r, i, "", function(e) {
			return e;
		})) : o != null && (D(o) && (o = ee(o, i + (o.key == null || e && e.key === o.key ? "" : ("" + o.key).replace(O, "$&/") + "/") + c)), r.push(o)), 1;
		c = 0;
		var l = a === "" ? "." : a + ":";
		if (S(e)) for (var u = 0; u < e.length; u++) a = e[u], s = l + k(a, u), c += j(a, r, i, s, o);
		else if (u = m(e), typeof u == "function") for (e = u.call(e), u = 0; !(a = e.next()).done;) a = a.value, s = l + k(a, u++), c += j(a, r, i, s, o);
		else if (s === "object") {
			if (typeof e.then == "function") return j(A(e), r, i, a, o);
			throw r = String(e), Error("Objects are not valid as a React child (found: " + (r === "[object Object]" ? "object with keys {" + Object.keys(e).join(", ") + "}" : r) + "). If you meant to render a collection of children, use an array instead.");
		}
		return c;
	}
	function M(e, t, n) {
		if (e == null) return e;
		var r = [], i = 0;
		return j(e, r, "", "", function(e) {
			return t.call(n, e, i++);
		}), r;
	}
	function N(e) {
		if (e._status === -1) {
			var t = e._result;
			t = t(), t.then(function(t) {
				(e._status === 0 || e._status === -1) && (e._status = 1, e._result = t);
			}, function(t) {
				(e._status === 0 || e._status === -1) && (e._status = 2, e._result = t);
			}), e._status === -1 && (e._status = 0, e._result = t);
		}
		if (e._status === 1) return e._result.default;
		throw e._result;
	}
	var P = typeof reportError == "function" ? reportError : function(e) {
		if (typeof window == "object" && typeof window.ErrorEvent == "function") {
			var t = new window.ErrorEvent("error", {
				bubbles: !0,
				cancelable: !0,
				message: typeof e == "object" && e && typeof e.message == "string" ? String(e.message) : String(e),
				error: e
			});
			if (!window.dispatchEvent(t)) return;
		} else if (typeof process == "object" && typeof process.emit == "function") {
			process.emit("uncaughtException", e);
			return;
		}
		console.error(e);
	}, F = {
		map: M,
		forEach: function(e, t, n) {
			M(e, function() {
				t.apply(this, arguments);
			}, n);
		},
		count: function(e) {
			var t = 0;
			return M(e, function() {
				t++;
			}), t;
		},
		toArray: function(e) {
			return M(e, function(e) {
				return e;
			}) || [];
		},
		only: function(e) {
			if (!D(e)) throw Error("React.Children.only expected to receive a single React element child.");
			return e;
		}
	};
	e.Activity = f, e.Children = F, e.Component = v, e.Fragment = r, e.Profiler = a, e.PureComponent = b, e.StrictMode = i, e.Suspense = l, e.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = w, e.__COMPILER_RUNTIME = {
		__proto__: null,
		c: function(e) {
			return w.H.useMemoCache(e);
		}
	}, e.cache = function(e) {
		return function() {
			return e.apply(null, arguments);
		};
	}, e.cacheSignal = function() {
		return null;
	}, e.cloneElement = function(e, t, n) {
		if (e == null) throw Error("The argument must be a React element, but you passed " + e + ".");
		var r = g({}, e.props), i = e.key;
		if (t != null) for (a in t.key !== void 0 && (i = "" + t.key), t) !T.call(t, a) || a === "key" || a === "__self" || a === "__source" || a === "ref" && t.ref === void 0 || (r[a] = t[a]);
		var a = arguments.length - 2;
		if (a === 1) r.children = n;
		else if (1 < a) {
			for (var o = Array(a), s = 0; s < a; s++) o[s] = arguments[s + 2];
			r.children = o;
		}
		return E(e.type, i, r);
	}, e.createContext = function(e) {
		return e = {
			$$typeof: s,
			_currentValue: e,
			_currentValue2: e,
			_threadCount: 0,
			Provider: null,
			Consumer: null
		}, e.Provider = e, e.Consumer = {
			$$typeof: o,
			_context: e
		}, e;
	}, e.createElement = function(e, t, n) {
		var r, i = {}, a = null;
		if (t != null) for (r in t.key !== void 0 && (a = "" + t.key), t) T.call(t, r) && r !== "key" && r !== "__self" && r !== "__source" && (i[r] = t[r]);
		var o = arguments.length - 2;
		if (o === 1) i.children = n;
		else if (1 < o) {
			for (var s = Array(o), c = 0; c < o; c++) s[c] = arguments[c + 2];
			i.children = s;
		}
		if (e && e.defaultProps) for (r in o = e.defaultProps, o) i[r] === void 0 && (i[r] = o[r]);
		return E(e, a, i);
	}, e.createRef = function() {
		return { current: null };
	}, e.forwardRef = function(e) {
		return {
			$$typeof: c,
			render: e
		};
	}, e.isValidElement = D, e.lazy = function(e) {
		return {
			$$typeof: d,
			_payload: {
				_status: -1,
				_result: e
			},
			_init: N
		};
	}, e.memo = function(e, t) {
		return {
			$$typeof: u,
			type: e,
			compare: t === void 0 ? null : t
		};
	}, e.startTransition = function(e) {
		var t = w.T, n = {};
		w.T = n;
		try {
			var r = e(), i = w.S;
			i !== null && i(n, r), typeof r == "object" && r && typeof r.then == "function" && r.then(C, P);
		} catch (e) {
			P(e);
		} finally {
			t !== null && n.types !== null && (t.types = n.types), w.T = t;
		}
	}, e.unstable_useCacheRefresh = function() {
		return w.H.useCacheRefresh();
	}, e.use = function(e) {
		return w.H.use(e);
	}, e.useActionState = function(e, t, n) {
		return w.H.useActionState(e, t, n);
	}, e.useCallback = function(e, t) {
		return w.H.useCallback(e, t);
	}, e.useContext = function(e) {
		return w.H.useContext(e);
	}, e.useDebugValue = function() {}, e.useDeferredValue = function(e, t) {
		return w.H.useDeferredValue(e, t);
	}, e.useEffect = function(e, t) {
		return w.H.useEffect(e, t);
	}, e.useEffectEvent = function(e) {
		return w.H.useEffectEvent(e);
	}, e.useId = function() {
		return w.H.useId();
	}, e.useImperativeHandle = function(e, t, n) {
		return w.H.useImperativeHandle(e, t, n);
	}, e.useInsertionEffect = function(e, t) {
		return w.H.useInsertionEffect(e, t);
	}, e.useLayoutEffect = function(e, t) {
		return w.H.useLayoutEffect(e, t);
	}, e.useMemo = function(e, t) {
		return w.H.useMemo(e, t);
	}, e.useOptimistic = function(e, t) {
		return w.H.useOptimistic(e, t);
	}, e.useReducer = function(e, t, n) {
		return w.H.useReducer(e, t, n);
	}, e.useRef = function(e) {
		return w.H.useRef(e);
	}, e.useState = function(e) {
		return w.H.useState(e);
	}, e.useSyncExternalStore = function(e, t, n) {
		return w.H.useSyncExternalStore(e, t, n);
	}, e.useTransition = function() {
		return w.H.useTransition();
	}, e.version = "19.2.7";
})), u = /* @__PURE__ */ o(((e, t) => {
	t.exports = l();
})), d = /* @__PURE__ */ o(((e) => {
	function t(e, t) {
		var n = e.length;
		e.push(t);
		a: for (; 0 < n;) {
			var r = n - 1 >>> 1, a = e[r];
			if (0 < i(a, t)) e[r] = t, e[n] = a, n = r;
			else break a;
		}
	}
	function n(e) {
		return e.length === 0 ? null : e[0];
	}
	function r(e) {
		if (e.length === 0) return null;
		var t = e[0], n = e.pop();
		if (n !== t) {
			e[0] = n;
			a: for (var r = 0, a = e.length, o = a >>> 1; r < o;) {
				var s = 2 * (r + 1) - 1, c = e[s], l = s + 1, u = e[l];
				if (0 > i(c, n)) l < a && 0 > i(u, c) ? (e[r] = u, e[l] = n, r = l) : (e[r] = c, e[s] = n, r = s);
				else if (l < a && 0 > i(u, n)) e[r] = u, e[l] = n, r = l;
				else break a;
			}
		}
		return t;
	}
	function i(e, t) {
		var n = e.sortIndex - t.sortIndex;
		return n === 0 ? e.id - t.id : n;
	}
	if (e.unstable_now = void 0, typeof performance == "object" && typeof performance.now == "function") {
		var a = performance;
		e.unstable_now = function() {
			return a.now();
		};
	} else {
		var o = Date, s = o.now();
		e.unstable_now = function() {
			return o.now() - s;
		};
	}
	var c = [], l = [], u = 1, d = null, f = 3, p = !1, m = !1, h = !1, g = !1, _ = typeof setTimeout == "function" ? setTimeout : null, v = typeof clearTimeout == "function" ? clearTimeout : null, y = typeof setImmediate < "u" ? setImmediate : null;
	function b(e) {
		for (var i = n(l); i !== null;) {
			if (i.callback === null) r(l);
			else if (i.startTime <= e) r(l), i.sortIndex = i.expirationTime, t(c, i);
			else break;
			i = n(l);
		}
	}
	function x(e) {
		if (h = !1, b(e), !m) if (n(c) !== null) m = !0, S || (S = !0, D());
		else {
			var t = n(l);
			t !== null && k(x, t.startTime - e);
		}
	}
	var S = !1, C = -1, w = 5, T = -1;
	function E() {
		return g ? !0 : !(e.unstable_now() - T < w);
	}
	function ee() {
		if (g = !1, S) {
			var t = e.unstable_now();
			T = t;
			var i = !0;
			try {
				a: {
					m = !1, h && (h = !1, v(C), C = -1), p = !0;
					var a = f;
					try {
						b: {
							for (b(t), d = n(c); d !== null && !(d.expirationTime > t && E());) {
								var o = d.callback;
								if (typeof o == "function") {
									d.callback = null, f = d.priorityLevel;
									var s = o(d.expirationTime <= t);
									if (t = e.unstable_now(), typeof s == "function") {
										d.callback = s, b(t), i = !0;
										break b;
									}
									d === n(c) && r(c), b(t);
								} else r(c);
								d = n(c);
							}
							if (d !== null) i = !0;
							else {
								var u = n(l);
								u !== null && k(x, u.startTime - t), i = !1;
							}
						}
						break a;
					} finally {
						d = null, f = a, p = !1;
					}
					i = void 0;
				}
			} finally {
				i ? D() : S = !1;
			}
		}
	}
	var D;
	if (typeof y == "function") D = function() {
		y(ee);
	};
	else if (typeof MessageChannel < "u") {
		var te = new MessageChannel(), O = te.port2;
		te.port1.onmessage = ee, D = function() {
			O.postMessage(null);
		};
	} else D = function() {
		_(ee, 0);
	};
	function k(t, n) {
		C = _(function() {
			t(e.unstable_now());
		}, n);
	}
	e.unstable_IdlePriority = 5, e.unstable_ImmediatePriority = 1, e.unstable_LowPriority = 4, e.unstable_NormalPriority = 3, e.unstable_Profiling = null, e.unstable_UserBlockingPriority = 2, e.unstable_cancelCallback = function(e) {
		e.callback = null;
	}, e.unstable_forceFrameRate = function(e) {
		0 > e || 125 < e ? console.error("forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported") : w = 0 < e ? Math.floor(1e3 / e) : 5;
	}, e.unstable_getCurrentPriorityLevel = function() {
		return f;
	}, e.unstable_next = function(e) {
		switch (f) {
			case 1:
			case 2:
			case 3:
				var t = 3;
				break;
			default: t = f;
		}
		var n = f;
		f = t;
		try {
			return e();
		} finally {
			f = n;
		}
	}, e.unstable_requestPaint = function() {
		g = !0;
	}, e.unstable_runWithPriority = function(e, t) {
		switch (e) {
			case 1:
			case 2:
			case 3:
			case 4:
			case 5: break;
			default: e = 3;
		}
		var n = f;
		f = e;
		try {
			return t();
		} finally {
			f = n;
		}
	}, e.unstable_scheduleCallback = function(r, i, a) {
		var o = e.unstable_now();
		switch (typeof a == "object" && a ? (a = a.delay, a = typeof a == "number" && 0 < a ? o + a : o) : a = o, r) {
			case 1:
				var s = -1;
				break;
			case 2:
				s = 250;
				break;
			case 5:
				s = 1073741823;
				break;
			case 4:
				s = 1e4;
				break;
			default: s = 5e3;
		}
		return s = a + s, r = {
			id: u++,
			callback: i,
			priorityLevel: r,
			startTime: a,
			expirationTime: s,
			sortIndex: -1
		}, a > o ? (r.sortIndex = a, t(l, r), n(c) === null && r === n(l) && (h ? (v(C), C = -1) : h = !0, k(x, a - o))) : (r.sortIndex = s, t(c, r), m || p || (m = !0, S || (S = !0, D()))), r;
	}, e.unstable_shouldYield = E, e.unstable_wrapCallback = function(e) {
		var t = f;
		return function() {
			var n = f;
			f = t;
			try {
				return e.apply(this, arguments);
			} finally {
				f = n;
			}
		};
	};
})), f = /* @__PURE__ */ o(((e, t) => {
	t.exports = d();
})), p = /* @__PURE__ */ o(((e) => {
	var t = u();
	function n(e) {
		var t = "https://react.dev/errors/" + e;
		if (1 < arguments.length) {
			t += "?args[]=" + encodeURIComponent(arguments[1]);
			for (var n = 2; n < arguments.length; n++) t += "&args[]=" + encodeURIComponent(arguments[n]);
		}
		return "Minified React error #" + e + "; visit " + t + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
	}
	function r() {}
	var i = {
		d: {
			f: r,
			r: function() {
				throw Error(n(522));
			},
			D: r,
			C: r,
			L: r,
			m: r,
			X: r,
			S: r,
			M: r
		},
		p: 0,
		findDOMNode: null
	}, a = Symbol.for("react.portal");
	function o(e, t, n) {
		var r = 3 < arguments.length && arguments[3] !== void 0 ? arguments[3] : null;
		return {
			$$typeof: a,
			key: r == null ? null : "" + r,
			children: e,
			containerInfo: t,
			implementation: n
		};
	}
	var s = t.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
	function c(e, t) {
		if (e === "font") return "";
		if (typeof t == "string") return t === "use-credentials" ? t : "";
	}
	e.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = i, e.createPortal = function(e, t) {
		var r = 2 < arguments.length && arguments[2] !== void 0 ? arguments[2] : null;
		if (!t || t.nodeType !== 1 && t.nodeType !== 9 && t.nodeType !== 11) throw Error(n(299));
		return o(e, t, null, r);
	}, e.flushSync = function(e) {
		var t = s.T, n = i.p;
		try {
			if (s.T = null, i.p = 2, e) return e();
		} finally {
			s.T = t, i.p = n, i.d.f();
		}
	}, e.preconnect = function(e, t) {
		typeof e == "string" && (t ? (t = t.crossOrigin, t = typeof t == "string" ? t === "use-credentials" ? t : "" : void 0) : t = null, i.d.C(e, t));
	}, e.prefetchDNS = function(e) {
		typeof e == "string" && i.d.D(e);
	}, e.preinit = function(e, t) {
		if (typeof e == "string" && t && typeof t.as == "string") {
			var n = t.as, r = c(n, t.crossOrigin), a = typeof t.integrity == "string" ? t.integrity : void 0, o = typeof t.fetchPriority == "string" ? t.fetchPriority : void 0;
			n === "style" ? i.d.S(e, typeof t.precedence == "string" ? t.precedence : void 0, {
				crossOrigin: r,
				integrity: a,
				fetchPriority: o
			}) : n === "script" && i.d.X(e, {
				crossOrigin: r,
				integrity: a,
				fetchPriority: o,
				nonce: typeof t.nonce == "string" ? t.nonce : void 0
			});
		}
	}, e.preinitModule = function(e, t) {
		if (typeof e == "string") if (typeof t == "object" && t) {
			if (t.as == null || t.as === "script") {
				var n = c(t.as, t.crossOrigin);
				i.d.M(e, {
					crossOrigin: n,
					integrity: typeof t.integrity == "string" ? t.integrity : void 0,
					nonce: typeof t.nonce == "string" ? t.nonce : void 0
				});
			}
		} else t ?? i.d.M(e);
	}, e.preload = function(e, t) {
		if (typeof e == "string" && typeof t == "object" && t && typeof t.as == "string") {
			var n = t.as, r = c(n, t.crossOrigin);
			i.d.L(e, n, {
				crossOrigin: r,
				integrity: typeof t.integrity == "string" ? t.integrity : void 0,
				nonce: typeof t.nonce == "string" ? t.nonce : void 0,
				type: typeof t.type == "string" ? t.type : void 0,
				fetchPriority: typeof t.fetchPriority == "string" ? t.fetchPriority : void 0,
				referrerPolicy: typeof t.referrerPolicy == "string" ? t.referrerPolicy : void 0,
				imageSrcSet: typeof t.imageSrcSet == "string" ? t.imageSrcSet : void 0,
				imageSizes: typeof t.imageSizes == "string" ? t.imageSizes : void 0,
				media: typeof t.media == "string" ? t.media : void 0
			});
		}
	}, e.preloadModule = function(e, t) {
		if (typeof e == "string") if (t) {
			var n = c(t.as, t.crossOrigin);
			i.d.m(e, {
				as: typeof t.as == "string" && t.as !== "script" ? t.as : void 0,
				crossOrigin: n,
				integrity: typeof t.integrity == "string" ? t.integrity : void 0
			});
		} else i.d.m(e);
	}, e.requestFormReset = function(e) {
		i.d.r(e);
	}, e.unstable_batchedUpdates = function(e, t) {
		return e(t);
	}, e.useFormState = function(e, t, n) {
		return s.H.useFormState(e, t, n);
	}, e.useFormStatus = function() {
		return s.H.useHostTransitionStatus();
	}, e.version = "19.2.7";
})), m = /* @__PURE__ */ o(((e, t) => {
	function n() {
		if (!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u" || typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE != "function")) try {
			__REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(n);
		} catch (e) {
			console.error(e);
		}
	}
	n(), t.exports = p();
})), h = /* @__PURE__ */ o(((e) => {
	var t = f(), n = u(), r = m();
	function i(e) {
		var t = "https://react.dev/errors/" + e;
		if (1 < arguments.length) {
			t += "?args[]=" + encodeURIComponent(arguments[1]);
			for (var n = 2; n < arguments.length; n++) t += "&args[]=" + encodeURIComponent(arguments[n]);
		}
		return "Minified React error #" + e + "; visit " + t + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
	}
	function a(e) {
		return !(!e || e.nodeType !== 1 && e.nodeType !== 9 && e.nodeType !== 11);
	}
	function o(e) {
		var t = e, n = e;
		if (e.alternate) for (; t.return;) t = t.return;
		else {
			e = t;
			do
				t = e, t.flags & 4098 && (n = t.return), e = t.return;
			while (e);
		}
		return t.tag === 3 ? n : null;
	}
	function s(e) {
		if (e.tag === 13) {
			var t = e.memoizedState;
			if (t === null && (e = e.alternate, e !== null && (t = e.memoizedState)), t !== null) return t.dehydrated;
		}
		return null;
	}
	function c(e) {
		if (e.tag === 31) {
			var t = e.memoizedState;
			if (t === null && (e = e.alternate, e !== null && (t = e.memoizedState)), t !== null) return t.dehydrated;
		}
		return null;
	}
	function l(e) {
		if (o(e) !== e) throw Error(i(188));
	}
	function d(e) {
		var t = e.alternate;
		if (!t) {
			if (t = o(e), t === null) throw Error(i(188));
			return t === e ? e : null;
		}
		for (var n = e, r = t;;) {
			var a = n.return;
			if (a === null) break;
			var s = a.alternate;
			if (s === null) {
				if (r = a.return, r !== null) {
					n = r;
					continue;
				}
				break;
			}
			if (a.child === s.child) {
				for (s = a.child; s;) {
					if (s === n) return l(a), e;
					if (s === r) return l(a), t;
					s = s.sibling;
				}
				throw Error(i(188));
			}
			if (n.return !== r.return) n = a, r = s;
			else {
				for (var c = !1, u = a.child; u;) {
					if (u === n) {
						c = !0, n = a, r = s;
						break;
					}
					if (u === r) {
						c = !0, r = a, n = s;
						break;
					}
					u = u.sibling;
				}
				if (!c) {
					for (u = s.child; u;) {
						if (u === n) {
							c = !0, n = s, r = a;
							break;
						}
						if (u === r) {
							c = !0, r = s, n = a;
							break;
						}
						u = u.sibling;
					}
					if (!c) throw Error(i(189));
				}
			}
			if (n.alternate !== r) throw Error(i(190));
		}
		if (n.tag !== 3) throw Error(i(188));
		return n.stateNode.current === n ? e : t;
	}
	function p(e) {
		var t = e.tag;
		if (t === 5 || t === 26 || t === 27 || t === 6) return e;
		for (e = e.child; e !== null;) {
			if (t = p(e), t !== null) return t;
			e = e.sibling;
		}
		return null;
	}
	var h = Object.assign, g = Symbol.for("react.element"), _ = Symbol.for("react.transitional.element"), v = Symbol.for("react.portal"), y = Symbol.for("react.fragment"), b = Symbol.for("react.strict_mode"), x = Symbol.for("react.profiler"), S = Symbol.for("react.consumer"), C = Symbol.for("react.context"), w = Symbol.for("react.forward_ref"), T = Symbol.for("react.suspense"), E = Symbol.for("react.suspense_list"), ee = Symbol.for("react.memo"), D = Symbol.for("react.lazy"), te = Symbol.for("react.activity"), O = Symbol.for("react.memo_cache_sentinel"), k = Symbol.iterator;
	function A(e) {
		return typeof e != "object" || !e ? null : (e = k && e[k] || e["@@iterator"], typeof e == "function" ? e : null);
	}
	var j = Symbol.for("react.client.reference");
	function M(e) {
		if (e == null) return null;
		if (typeof e == "function") return e.$$typeof === j ? null : e.displayName || e.name || null;
		if (typeof e == "string") return e;
		switch (e) {
			case y: return "Fragment";
			case x: return "Profiler";
			case b: return "StrictMode";
			case T: return "Suspense";
			case E: return "SuspenseList";
			case te: return "Activity";
		}
		if (typeof e == "object") switch (e.$$typeof) {
			case v: return "Portal";
			case C: return e.displayName || "Context";
			case S: return (e._context.displayName || "Context") + ".Consumer";
			case w:
				var t = e.render;
				return e = e.displayName, e ||= (e = t.displayName || t.name || "", e === "" ? "ForwardRef" : "ForwardRef(" + e + ")"), e;
			case ee: return t = e.displayName || null, t === null ? M(e.type) || "Memo" : t;
			case D:
				t = e._payload, e = e._init;
				try {
					return M(e(t));
				} catch {}
		}
		return null;
	}
	var N = Array.isArray, P = n.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, F = r.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, I = {
		pending: !1,
		data: null,
		method: null,
		action: null
	}, ne = [], re = -1;
	function ie(e) {
		return { current: e };
	}
	function L(e) {
		0 > re || (e.current = ne[re], ne[re] = null, re--);
	}
	function R(e, t) {
		re++, ne[re] = e.current, e.current = t;
	}
	var ae = ie(null), oe = ie(null), z = ie(null), se = ie(null);
	function ce(e, t) {
		switch (R(z, t), R(oe, e), R(ae, null), t.nodeType) {
			case 9:
			case 11:
				e = (e = t.documentElement) && (e = e.namespaceURI) ? Vd(e) : 0;
				break;
			default: if (e = t.tagName, t = t.namespaceURI) t = Vd(t), e = Hd(t, e);
			else switch (e) {
				case "svg":
					e = 1;
					break;
				case "math":
					e = 2;
					break;
				default: e = 0;
			}
		}
		L(ae), R(ae, e);
	}
	function le() {
		L(ae), L(oe), L(z);
	}
	function ue(e) {
		e.memoizedState !== null && R(se, e);
		var t = ae.current, n = Hd(t, e.type);
		t !== n && (R(oe, e), R(ae, n));
	}
	function de(e) {
		oe.current === e && (L(ae), L(oe)), se.current === e && (L(se), Qf._currentValue = I);
	}
	var fe, pe;
	function me(e) {
		if (fe === void 0) try {
			throw Error();
		} catch (e) {
			var t = e.stack.trim().match(/\n( *(at )?)/);
			fe = t && t[1] || "", pe = -1 < e.stack.indexOf("\n    at") ? " (<anonymous>)" : -1 < e.stack.indexOf("@") ? "@unknown:0:0" : "";
		}
		return "\n" + fe + e + pe;
	}
	var he = !1;
	function ge(e, t) {
		if (!e || he) return "";
		he = !0;
		var n = Error.prepareStackTrace;
		Error.prepareStackTrace = void 0;
		try {
			var r = { DetermineComponentFrameRoot: function() {
				try {
					if (t) {
						var n = function() {
							throw Error();
						};
						if (Object.defineProperty(n.prototype, "props", { set: function() {
							throw Error();
						} }), typeof Reflect == "object" && Reflect.construct) {
							try {
								Reflect.construct(n, []);
							} catch (e) {
								var r = e;
							}
							Reflect.construct(e, [], n);
						} else {
							try {
								n.call();
							} catch (e) {
								r = e;
							}
							e.call(n.prototype);
						}
					} else {
						try {
							throw Error();
						} catch (e) {
							r = e;
						}
						(n = e()) && typeof n.catch == "function" && n.catch(function() {});
					}
				} catch (e) {
					if (e && r && typeof e.stack == "string") return [e.stack, r.stack];
				}
				return [null, null];
			} };
			r.DetermineComponentFrameRoot.displayName = "DetermineComponentFrameRoot";
			var i = Object.getOwnPropertyDescriptor(r.DetermineComponentFrameRoot, "name");
			i && i.configurable && Object.defineProperty(r.DetermineComponentFrameRoot, "name", { value: "DetermineComponentFrameRoot" });
			var a = r.DetermineComponentFrameRoot(), o = a[0], s = a[1];
			if (o && s) {
				var c = o.split("\n"), l = s.split("\n");
				for (i = r = 0; r < c.length && !c[r].includes("DetermineComponentFrameRoot");) r++;
				for (; i < l.length && !l[i].includes("DetermineComponentFrameRoot");) i++;
				if (r === c.length || i === l.length) for (r = c.length - 1, i = l.length - 1; 1 <= r && 0 <= i && c[r] !== l[i];) i--;
				for (; 1 <= r && 0 <= i; r--, i--) if (c[r] !== l[i]) {
					if (r !== 1 || i !== 1) do
						if (r--, i--, 0 > i || c[r] !== l[i]) {
							var u = "\n" + c[r].replace(" at new ", " at ");
							return e.displayName && u.includes("<anonymous>") && (u = u.replace("<anonymous>", e.displayName)), u;
						}
					while (1 <= r && 0 <= i);
					break;
				}
			}
		} finally {
			he = !1, Error.prepareStackTrace = n;
		}
		return (n = e ? e.displayName || e.name : "") ? me(n) : "";
	}
	function _e(e, t) {
		switch (e.tag) {
			case 26:
			case 27:
			case 5: return me(e.type);
			case 16: return me("Lazy");
			case 13: return e.child !== t && t !== null ? me("Suspense Fallback") : me("Suspense");
			case 19: return me("SuspenseList");
			case 0:
			case 15: return ge(e.type, !1);
			case 11: return ge(e.type.render, !1);
			case 1: return ge(e.type, !0);
			case 31: return me("Activity");
			default: return "";
		}
	}
	function ve(e) {
		try {
			var t = "", n = null;
			do
				t += _e(e, n), n = e, e = e.return;
			while (e);
			return t;
		} catch (e) {
			return "\nError generating stack: " + e.message + "\n" + e.stack;
		}
	}
	var ye = Object.prototype.hasOwnProperty, be = t.unstable_scheduleCallback, xe = t.unstable_cancelCallback, Se = t.unstable_shouldYield, Ce = t.unstable_requestPaint, we = t.unstable_now, Te = t.unstable_getCurrentPriorityLevel, Ee = t.unstable_ImmediatePriority, De = t.unstable_UserBlockingPriority, Oe = t.unstable_NormalPriority, ke = t.unstable_LowPriority, Ae = t.unstable_IdlePriority, je = t.log, Me = t.unstable_setDisableYieldValue, Ne = null, Pe = null;
	function Fe(e) {
		if (typeof je == "function" && Me(e), Pe && typeof Pe.setStrictMode == "function") try {
			Pe.setStrictMode(Ne, e);
		} catch {}
	}
	var Ie = Math.clz32 ? Math.clz32 : ze, Le = Math.log, Re = Math.LN2;
	function ze(e) {
		return e >>>= 0, e === 0 ? 32 : 31 - (Le(e) / Re | 0) | 0;
	}
	var Be = 256, Ve = 262144, He = 4194304;
	function Ue(e) {
		var t = e & 42;
		if (t !== 0) return t;
		switch (e & -e) {
			case 1: return 1;
			case 2: return 2;
			case 4: return 4;
			case 8: return 8;
			case 16: return 16;
			case 32: return 32;
			case 64: return 64;
			case 128: return 128;
			case 256:
			case 512:
			case 1024:
			case 2048:
			case 4096:
			case 8192:
			case 16384:
			case 32768:
			case 65536:
			case 131072: return e & 261888;
			case 262144:
			case 524288:
			case 1048576:
			case 2097152: return e & 3932160;
			case 4194304:
			case 8388608:
			case 16777216:
			case 33554432: return e & 62914560;
			case 67108864: return 67108864;
			case 134217728: return 134217728;
			case 268435456: return 268435456;
			case 536870912: return 536870912;
			case 1073741824: return 0;
			default: return e;
		}
	}
	function We(e, t, n) {
		var r = e.pendingLanes;
		if (r === 0) return 0;
		var i = 0, a = e.suspendedLanes, o = e.pingedLanes;
		e = e.warmLanes;
		var s = r & 134217727;
		return s === 0 ? (s = r & ~a, s === 0 ? o === 0 ? n || (n = r & ~e, n !== 0 && (i = Ue(n))) : i = Ue(o) : i = Ue(s)) : (r = s & ~a, r === 0 ? (o &= s, o === 0 ? n || (n = s & ~e, n !== 0 && (i = Ue(n))) : i = Ue(o)) : i = Ue(r)), i === 0 ? 0 : t !== 0 && t !== i && (t & a) === 0 && (a = i & -i, n = t & -t, a >= n || a === 32 && n & 4194048) ? t : i;
	}
	function Ge(e, t) {
		return (e.pendingLanes & ~(e.suspendedLanes & ~e.pingedLanes) & t) === 0;
	}
	function Ke(e, t) {
		switch (e) {
			case 1:
			case 2:
			case 4:
			case 8:
			case 64: return t + 250;
			case 16:
			case 32:
			case 128:
			case 256:
			case 512:
			case 1024:
			case 2048:
			case 4096:
			case 8192:
			case 16384:
			case 32768:
			case 65536:
			case 131072:
			case 262144:
			case 524288:
			case 1048576:
			case 2097152: return t + 5e3;
			case 4194304:
			case 8388608:
			case 16777216:
			case 33554432: return -1;
			case 67108864:
			case 134217728:
			case 268435456:
			case 536870912:
			case 1073741824: return -1;
			default: return -1;
		}
	}
	function qe() {
		var e = He;
		return He <<= 1, !(He & 62914560) && (He = 4194304), e;
	}
	function Je(e) {
		for (var t = [], n = 0; 31 > n; n++) t.push(e);
		return t;
	}
	function Ye(e, t) {
		e.pendingLanes |= t, t !== 268435456 && (e.suspendedLanes = 0, e.pingedLanes = 0, e.warmLanes = 0);
	}
	function Xe(e, t, n, r, i, a) {
		var o = e.pendingLanes;
		e.pendingLanes = n, e.suspendedLanes = 0, e.pingedLanes = 0, e.warmLanes = 0, e.expiredLanes &= n, e.entangledLanes &= n, e.errorRecoveryDisabledLanes &= n, e.shellSuspendCounter = 0;
		var s = e.entanglements, c = e.expirationTimes, l = e.hiddenUpdates;
		for (n = o & ~n; 0 < n;) {
			var u = 31 - Ie(n), d = 1 << u;
			s[u] = 0, c[u] = -1;
			var f = l[u];
			if (f !== null) for (l[u] = null, u = 0; u < f.length; u++) {
				var p = f[u];
				p !== null && (p.lane &= -536870913);
			}
			n &= ~d;
		}
		r !== 0 && Ze(e, r, 0), a !== 0 && i === 0 && e.tag !== 0 && (e.suspendedLanes |= a & ~(o & ~t));
	}
	function Ze(e, t, n) {
		e.pendingLanes |= t, e.suspendedLanes &= ~t;
		var r = 31 - Ie(t);
		e.entangledLanes |= t, e.entanglements[r] = e.entanglements[r] | 1073741824 | n & 261930;
	}
	function Qe(e, t) {
		var n = e.entangledLanes |= t;
		for (e = e.entanglements; n;) {
			var r = 31 - Ie(n), i = 1 << r;
			i & t | e[r] & t && (e[r] |= t), n &= ~i;
		}
	}
	function $e(e, t) {
		var n = t & -t;
		return n = n & 42 ? 1 : et(n), (n & (e.suspendedLanes | t)) === 0 ? n : 0;
	}
	function et(e) {
		switch (e) {
			case 2:
				e = 1;
				break;
			case 8:
				e = 4;
				break;
			case 32:
				e = 16;
				break;
			case 256:
			case 512:
			case 1024:
			case 2048:
			case 4096:
			case 8192:
			case 16384:
			case 32768:
			case 65536:
			case 131072:
			case 262144:
			case 524288:
			case 1048576:
			case 2097152:
			case 4194304:
			case 8388608:
			case 16777216:
			case 33554432:
				e = 128;
				break;
			case 268435456:
				e = 134217728;
				break;
			default: e = 0;
		}
		return e;
	}
	function tt(e) {
		return e &= -e, 2 < e ? 8 < e ? e & 134217727 ? 32 : 268435456 : 8 : 2;
	}
	function nt() {
		var e = F.p;
		return e === 0 ? (e = window.event, e === void 0 ? 32 : mp(e.type)) : e;
	}
	function rt(e, t) {
		var n = F.p;
		try {
			return F.p = e, t();
		} finally {
			F.p = n;
		}
	}
	var it = Math.random().toString(36).slice(2), at = "__reactFiber$" + it, ot = "__reactProps$" + it, st = "__reactContainer$" + it, ct = "__reactEvents$" + it, lt = "__reactListeners$" + it, ut = "__reactHandles$" + it, dt = "__reactResources$" + it, ft = "__reactMarker$" + it;
	function pt(e) {
		delete e[at], delete e[ot], delete e[ct], delete e[lt], delete e[ut];
	}
	function mt(e) {
		var t = e[at];
		if (t) return t;
		for (var n = e.parentNode; n;) {
			if (t = n[st] || n[at]) {
				if (n = t.alternate, t.child !== null || n !== null && n.child !== null) for (e = df(e); e !== null;) {
					if (n = e[at]) return n;
					e = df(e);
				}
				return t;
			}
			e = n, n = e.parentNode;
		}
		return null;
	}
	function ht(e) {
		if (e = e[at] || e[st]) {
			var t = e.tag;
			if (t === 5 || t === 6 || t === 13 || t === 31 || t === 26 || t === 27 || t === 3) return e;
		}
		return null;
	}
	function gt(e) {
		var t = e.tag;
		if (t === 5 || t === 26 || t === 27 || t === 6) return e.stateNode;
		throw Error(i(33));
	}
	function _t(e) {
		var t = e[dt];
		return t ||= e[dt] = {
			hoistableStyles: /* @__PURE__ */ new Map(),
			hoistableScripts: /* @__PURE__ */ new Map()
		}, t;
	}
	function vt(e) {
		e[ft] = !0;
	}
	var yt = /* @__PURE__ */ new Set(), bt = {};
	function xt(e, t) {
		St(e, t), St(e + "Capture", t);
	}
	function St(e, t) {
		for (bt[e] = t, e = 0; e < t.length; e++) yt.add(t[e]);
	}
	var Ct = RegExp("^[:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD][:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040]*$"), wt = {}, Tt = {};
	function Et(e) {
		return ye.call(Tt, e) ? !0 : ye.call(wt, e) ? !1 : Ct.test(e) ? Tt[e] = !0 : (wt[e] = !0, !1);
	}
	function Dt(e, t, n) {
		if (Et(t)) if (n === null) e.removeAttribute(t);
		else {
			switch (typeof n) {
				case "undefined":
				case "function":
				case "symbol":
					e.removeAttribute(t);
					return;
				case "boolean":
					var r = t.toLowerCase().slice(0, 5);
					if (r !== "data-" && r !== "aria-") {
						e.removeAttribute(t);
						return;
					}
			}
			e.setAttribute(t, "" + n);
		}
	}
	function Ot(e, t, n) {
		if (n === null) e.removeAttribute(t);
		else {
			switch (typeof n) {
				case "undefined":
				case "function":
				case "symbol":
				case "boolean":
					e.removeAttribute(t);
					return;
			}
			e.setAttribute(t, "" + n);
		}
	}
	function kt(e, t, n, r) {
		if (r === null) e.removeAttribute(n);
		else {
			switch (typeof r) {
				case "undefined":
				case "function":
				case "symbol":
				case "boolean":
					e.removeAttribute(n);
					return;
			}
			e.setAttributeNS(t, n, "" + r);
		}
	}
	function At(e) {
		switch (typeof e) {
			case "bigint":
			case "boolean":
			case "number":
			case "string":
			case "undefined": return e;
			case "object": return e;
			default: return "";
		}
	}
	function jt(e) {
		var t = e.type;
		return (e = e.nodeName) && e.toLowerCase() === "input" && (t === "checkbox" || t === "radio");
	}
	function Mt(e, t, n) {
		var r = Object.getOwnPropertyDescriptor(e.constructor.prototype, t);
		if (!e.hasOwnProperty(t) && r !== void 0 && typeof r.get == "function" && typeof r.set == "function") {
			var i = r.get, a = r.set;
			return Object.defineProperty(e, t, {
				configurable: !0,
				get: function() {
					return i.call(this);
				},
				set: function(e) {
					n = "" + e, a.call(this, e);
				}
			}), Object.defineProperty(e, t, { enumerable: r.enumerable }), {
				getValue: function() {
					return n;
				},
				setValue: function(e) {
					n = "" + e;
				},
				stopTracking: function() {
					e._valueTracker = null, delete e[t];
				}
			};
		}
	}
	function Nt(e) {
		if (!e._valueTracker) {
			var t = jt(e) ? "checked" : "value";
			e._valueTracker = Mt(e, t, "" + e[t]);
		}
	}
	function Pt(e) {
		if (!e) return !1;
		var t = e._valueTracker;
		if (!t) return !0;
		var n = t.getValue(), r = "";
		return e && (r = jt(e) ? e.checked ? "true" : "false" : e.value), e = r, e === n ? !1 : (t.setValue(e), !0);
	}
	function Ft(e) {
		if (e ||= typeof document < "u" ? document : void 0, e === void 0) return null;
		try {
			return e.activeElement || e.body;
		} catch {
			return e.body;
		}
	}
	var It = /[\n"\\]/g;
	function Lt(e) {
		return e.replace(It, function(e) {
			return "\\" + e.charCodeAt(0).toString(16) + " ";
		});
	}
	function Rt(e, t, n, r, i, a, o, s) {
		e.name = "", o != null && typeof o != "function" && typeof o != "symbol" && typeof o != "boolean" ? e.type = o : e.removeAttribute("type"), t == null ? o !== "submit" && o !== "reset" || e.removeAttribute("value") : o === "number" ? (t === 0 && e.value === "" || e.value != t) && (e.value = "" + At(t)) : e.value !== "" + At(t) && (e.value = "" + At(t)), t == null ? n == null ? r != null && e.removeAttribute("value") : Bt(e, o, At(n)) : Bt(e, o, At(t)), i == null && a != null && (e.defaultChecked = !!a), i != null && (e.checked = i && typeof i != "function" && typeof i != "symbol"), s != null && typeof s != "function" && typeof s != "symbol" && typeof s != "boolean" ? e.name = "" + At(s) : e.removeAttribute("name");
	}
	function zt(e, t, n, r, i, a, o, s) {
		if (a != null && typeof a != "function" && typeof a != "symbol" && typeof a != "boolean" && (e.type = a), t != null || n != null) {
			if (!(a !== "submit" && a !== "reset" || t != null)) {
				Nt(e);
				return;
			}
			n = n == null ? "" : "" + At(n), t = t == null ? n : "" + At(t), s || t === e.value || (e.value = t), e.defaultValue = t;
		}
		r ??= i, r = typeof r != "function" && typeof r != "symbol" && !!r, e.checked = s ? e.checked : !!r, e.defaultChecked = !!r, o != null && typeof o != "function" && typeof o != "symbol" && typeof o != "boolean" && (e.name = o), Nt(e);
	}
	function Bt(e, t, n) {
		t === "number" && Ft(e.ownerDocument) === e || e.defaultValue === "" + n || (e.defaultValue = "" + n);
	}
	function Vt(e, t, n, r) {
		if (e = e.options, t) {
			t = {};
			for (var i = 0; i < n.length; i++) t["$" + n[i]] = !0;
			for (n = 0; n < e.length; n++) i = t.hasOwnProperty("$" + e[n].value), e[n].selected !== i && (e[n].selected = i), i && r && (e[n].defaultSelected = !0);
		} else {
			for (n = "" + At(n), t = null, i = 0; i < e.length; i++) {
				if (e[i].value === n) {
					e[i].selected = !0, r && (e[i].defaultSelected = !0);
					return;
				}
				t !== null || e[i].disabled || (t = e[i]);
			}
			t !== null && (t.selected = !0);
		}
	}
	function Ht(e, t, n) {
		if (t != null && (t = "" + At(t), t !== e.value && (e.value = t), n == null)) {
			e.defaultValue !== t && (e.defaultValue = t);
			return;
		}
		e.defaultValue = n == null ? "" : "" + At(n);
	}
	function Ut(e, t, n, r) {
		if (t == null) {
			if (r != null) {
				if (n != null) throw Error(i(92));
				if (N(r)) {
					if (1 < r.length) throw Error(i(93));
					r = r[0];
				}
				n = r;
			}
			n ??= "", t = n;
		}
		n = At(t), e.defaultValue = n, r = e.textContent, r === n && r !== "" && r !== null && (e.value = r), Nt(e);
	}
	function Wt(e, t) {
		if (t) {
			var n = e.firstChild;
			if (n && n === e.lastChild && n.nodeType === 3) {
				n.nodeValue = t;
				return;
			}
		}
		e.textContent = t;
	}
	var Gt = new Set("animationIterationCount aspectRatio borderImageOutset borderImageSlice borderImageWidth boxFlex boxFlexGroup boxOrdinalGroup columnCount columns flex flexGrow flexPositive flexShrink flexNegative flexOrder gridArea gridRow gridRowEnd gridRowSpan gridRowStart gridColumn gridColumnEnd gridColumnSpan gridColumnStart fontWeight lineClamp lineHeight opacity order orphans scale tabSize widows zIndex zoom fillOpacity floodOpacity stopOpacity strokeDasharray strokeDashoffset strokeMiterlimit strokeOpacity strokeWidth MozAnimationIterationCount MozBoxFlex MozBoxFlexGroup MozLineClamp msAnimationIterationCount msFlex msZoom msFlexGrow msFlexNegative msFlexOrder msFlexPositive msFlexShrink msGridColumn msGridColumnSpan msGridRow msGridRowSpan WebkitAnimationIterationCount WebkitBoxFlex WebKitBoxFlexGroup WebkitBoxOrdinalGroup WebkitColumnCount WebkitColumns WebkitFlex WebkitFlexGrow WebkitFlexPositive WebkitFlexShrink WebkitLineClamp".split(" "));
	function Kt(e, t, n) {
		var r = t.indexOf("--") === 0;
		n == null || typeof n == "boolean" || n === "" ? r ? e.setProperty(t, "") : t === "float" ? e.cssFloat = "" : e[t] = "" : r ? e.setProperty(t, n) : typeof n != "number" || n === 0 || Gt.has(t) ? t === "float" ? e.cssFloat = n : e[t] = ("" + n).trim() : e[t] = n + "px";
	}
	function qt(e, t, n) {
		if (t != null && typeof t != "object") throw Error(i(62));
		if (e = e.style, n != null) {
			for (var r in n) !n.hasOwnProperty(r) || t != null && t.hasOwnProperty(r) || (r.indexOf("--") === 0 ? e.setProperty(r, "") : r === "float" ? e.cssFloat = "" : e[r] = "");
			for (var a in t) r = t[a], t.hasOwnProperty(a) && n[a] !== r && Kt(e, a, r);
		} else for (var o in t) t.hasOwnProperty(o) && Kt(e, o, t[o]);
	}
	function Jt(e) {
		if (e.indexOf("-") === -1) return !1;
		switch (e) {
			case "annotation-xml":
			case "color-profile":
			case "font-face":
			case "font-face-src":
			case "font-face-uri":
			case "font-face-format":
			case "font-face-name":
			case "missing-glyph": return !1;
			default: return !0;
		}
	}
	var Yt = /* @__PURE__ */ new Map([
		["acceptCharset", "accept-charset"],
		["htmlFor", "for"],
		["httpEquiv", "http-equiv"],
		["crossOrigin", "crossorigin"],
		["accentHeight", "accent-height"],
		["alignmentBaseline", "alignment-baseline"],
		["arabicForm", "arabic-form"],
		["baselineShift", "baseline-shift"],
		["capHeight", "cap-height"],
		["clipPath", "clip-path"],
		["clipRule", "clip-rule"],
		["colorInterpolation", "color-interpolation"],
		["colorInterpolationFilters", "color-interpolation-filters"],
		["colorProfile", "color-profile"],
		["colorRendering", "color-rendering"],
		["dominantBaseline", "dominant-baseline"],
		["enableBackground", "enable-background"],
		["fillOpacity", "fill-opacity"],
		["fillRule", "fill-rule"],
		["floodColor", "flood-color"],
		["floodOpacity", "flood-opacity"],
		["fontFamily", "font-family"],
		["fontSize", "font-size"],
		["fontSizeAdjust", "font-size-adjust"],
		["fontStretch", "font-stretch"],
		["fontStyle", "font-style"],
		["fontVariant", "font-variant"],
		["fontWeight", "font-weight"],
		["glyphName", "glyph-name"],
		["glyphOrientationHorizontal", "glyph-orientation-horizontal"],
		["glyphOrientationVertical", "glyph-orientation-vertical"],
		["horizAdvX", "horiz-adv-x"],
		["horizOriginX", "horiz-origin-x"],
		["imageRendering", "image-rendering"],
		["letterSpacing", "letter-spacing"],
		["lightingColor", "lighting-color"],
		["markerEnd", "marker-end"],
		["markerMid", "marker-mid"],
		["markerStart", "marker-start"],
		["overlinePosition", "overline-position"],
		["overlineThickness", "overline-thickness"],
		["paintOrder", "paint-order"],
		["panose-1", "panose-1"],
		["pointerEvents", "pointer-events"],
		["renderingIntent", "rendering-intent"],
		["shapeRendering", "shape-rendering"],
		["stopColor", "stop-color"],
		["stopOpacity", "stop-opacity"],
		["strikethroughPosition", "strikethrough-position"],
		["strikethroughThickness", "strikethrough-thickness"],
		["strokeDasharray", "stroke-dasharray"],
		["strokeDashoffset", "stroke-dashoffset"],
		["strokeLinecap", "stroke-linecap"],
		["strokeLinejoin", "stroke-linejoin"],
		["strokeMiterlimit", "stroke-miterlimit"],
		["strokeOpacity", "stroke-opacity"],
		["strokeWidth", "stroke-width"],
		["textAnchor", "text-anchor"],
		["textDecoration", "text-decoration"],
		["textRendering", "text-rendering"],
		["transformOrigin", "transform-origin"],
		["underlinePosition", "underline-position"],
		["underlineThickness", "underline-thickness"],
		["unicodeBidi", "unicode-bidi"],
		["unicodeRange", "unicode-range"],
		["unitsPerEm", "units-per-em"],
		["vAlphabetic", "v-alphabetic"],
		["vHanging", "v-hanging"],
		["vIdeographic", "v-ideographic"],
		["vMathematical", "v-mathematical"],
		["vectorEffect", "vector-effect"],
		["vertAdvY", "vert-adv-y"],
		["vertOriginX", "vert-origin-x"],
		["vertOriginY", "vert-origin-y"],
		["wordSpacing", "word-spacing"],
		["writingMode", "writing-mode"],
		["xmlnsXlink", "xmlns:xlink"],
		["xHeight", "x-height"]
	]), Xt = /^[\u0000-\u001F ]*j[\r\n\t]*a[\r\n\t]*v[\r\n\t]*a[\r\n\t]*s[\r\n\t]*c[\r\n\t]*r[\r\n\t]*i[\r\n\t]*p[\r\n\t]*t[\r\n\t]*:/i;
	function Zt(e) {
		return Xt.test("" + e) ? "javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')" : e;
	}
	function Qt() {}
	var $t = null;
	function en(e) {
		return e = e.target || e.srcElement || window, e.correspondingUseElement && (e = e.correspondingUseElement), e.nodeType === 3 ? e.parentNode : e;
	}
	var tn = null, nn = null;
	function rn(e) {
		var t = ht(e);
		if (t && (e = t.stateNode)) {
			var n = e[ot] || null;
			a: switch (e = t.stateNode, t.type) {
				case "input":
					if (Rt(e, n.value, n.defaultValue, n.defaultValue, n.checked, n.defaultChecked, n.type, n.name), t = n.name, n.type === "radio" && t != null) {
						for (n = e; n.parentNode;) n = n.parentNode;
						for (n = n.querySelectorAll("input[name=\"" + Lt("" + t) + "\"][type=\"radio\"]"), t = 0; t < n.length; t++) {
							var r = n[t];
							if (r !== e && r.form === e.form) {
								var a = r[ot] || null;
								if (!a) throw Error(i(90));
								Rt(r, a.value, a.defaultValue, a.defaultValue, a.checked, a.defaultChecked, a.type, a.name);
							}
						}
						for (t = 0; t < n.length; t++) r = n[t], r.form === e.form && Pt(r);
					}
					break a;
				case "textarea":
					Ht(e, n.value, n.defaultValue);
					break a;
				case "select": t = n.value, t != null && Vt(e, !!n.multiple, t, !1);
			}
		}
	}
	var an = !1;
	function on(e, t, n) {
		if (an) return e(t, n);
		an = !0;
		try {
			return e(t);
		} finally {
			if (an = !1, (tn !== null || nn !== null) && (bu(), tn && (t = tn, e = nn, nn = tn = null, rn(t), e))) for (t = 0; t < e.length; t++) rn(e[t]);
		}
	}
	function sn(e, t) {
		var n = e.stateNode;
		if (n === null) return null;
		var r = n[ot] || null;
		if (r === null) return null;
		n = r[t];
		a: switch (t) {
			case "onClick":
			case "onClickCapture":
			case "onDoubleClick":
			case "onDoubleClickCapture":
			case "onMouseDown":
			case "onMouseDownCapture":
			case "onMouseMove":
			case "onMouseMoveCapture":
			case "onMouseUp":
			case "onMouseUpCapture":
			case "onMouseEnter":
				(r = !r.disabled) || (e = e.type, r = !(e === "button" || e === "input" || e === "select" || e === "textarea")), e = !r;
				break a;
			default: e = !1;
		}
		if (e) return null;
		if (n && typeof n != "function") throw Error(i(231, t, typeof n));
		return n;
	}
	var cn = !(typeof window > "u" || window.document === void 0 || window.document.createElement === void 0), ln = !1;
	if (cn) try {
		var un = {};
		Object.defineProperty(un, "passive", { get: function() {
			ln = !0;
		} }), window.addEventListener("test", un, un), window.removeEventListener("test", un, un);
	} catch {
		ln = !1;
	}
	var dn = null, fn = null, pn = null;
	function mn() {
		if (pn) return pn;
		var e, t = fn, n = t.length, r, i = "value" in dn ? dn.value : dn.textContent, a = i.length;
		for (e = 0; e < n && t[e] === i[e]; e++);
		var o = n - e;
		for (r = 1; r <= o && t[n - r] === i[a - r]; r++);
		return pn = i.slice(e, 1 < r ? 1 - r : void 0);
	}
	function hn(e) {
		var t = e.keyCode;
		return "charCode" in e ? (e = e.charCode, e === 0 && t === 13 && (e = 13)) : e = t, e === 10 && (e = 13), 32 <= e || e === 13 ? e : 0;
	}
	function gn() {
		return !0;
	}
	function _n() {
		return !1;
	}
	function vn(e) {
		function t(t, n, r, i, a) {
			for (var o in this._reactName = t, this._targetInst = r, this.type = n, this.nativeEvent = i, this.target = a, this.currentTarget = null, e) e.hasOwnProperty(o) && (t = e[o], this[o] = t ? t(i) : i[o]);
			return this.isDefaultPrevented = (i.defaultPrevented == null ? !1 === i.returnValue : i.defaultPrevented) ? gn : _n, this.isPropagationStopped = _n, this;
		}
		return h(t.prototype, {
			preventDefault: function() {
				this.defaultPrevented = !0;
				var e = this.nativeEvent;
				e && (e.preventDefault ? e.preventDefault() : typeof e.returnValue != "unknown" && (e.returnValue = !1), this.isDefaultPrevented = gn);
			},
			stopPropagation: function() {
				var e = this.nativeEvent;
				e && (e.stopPropagation ? e.stopPropagation() : typeof e.cancelBubble != "unknown" && (e.cancelBubble = !0), this.isPropagationStopped = gn);
			},
			persist: function() {},
			isPersistent: gn
		}), t;
	}
	var yn = {
		eventPhase: 0,
		bubbles: 0,
		cancelable: 0,
		timeStamp: function(e) {
			return e.timeStamp || Date.now();
		},
		defaultPrevented: 0,
		isTrusted: 0
	}, bn = vn(yn), xn = h({}, yn, {
		view: 0,
		detail: 0
	}), Sn = vn(xn), Cn, wn, Tn, En = h({}, xn, {
		screenX: 0,
		screenY: 0,
		clientX: 0,
		clientY: 0,
		pageX: 0,
		pageY: 0,
		ctrlKey: 0,
		shiftKey: 0,
		altKey: 0,
		metaKey: 0,
		getModifierState: Ln,
		button: 0,
		buttons: 0,
		relatedTarget: function(e) {
			return e.relatedTarget === void 0 ? e.fromElement === e.srcElement ? e.toElement : e.fromElement : e.relatedTarget;
		},
		movementX: function(e) {
			return "movementX" in e ? e.movementX : (e !== Tn && (Tn && e.type === "mousemove" ? (Cn = e.screenX - Tn.screenX, wn = e.screenY - Tn.screenY) : wn = Cn = 0, Tn = e), Cn);
		},
		movementY: function(e) {
			return "movementY" in e ? e.movementY : wn;
		}
	}), Dn = vn(En), On = vn(h({}, En, { dataTransfer: 0 })), kn = vn(h({}, xn, { relatedTarget: 0 })), An = vn(h({}, yn, {
		animationName: 0,
		elapsedTime: 0,
		pseudoElement: 0
	})), jn = vn(h({}, yn, { clipboardData: function(e) {
		return "clipboardData" in e ? e.clipboardData : window.clipboardData;
	} })), Mn = vn(h({}, yn, { data: 0 })), Nn = {
		Esc: "Escape",
		Spacebar: " ",
		Left: "ArrowLeft",
		Up: "ArrowUp",
		Right: "ArrowRight",
		Down: "ArrowDown",
		Del: "Delete",
		Win: "OS",
		Menu: "ContextMenu",
		Apps: "ContextMenu",
		Scroll: "ScrollLock",
		MozPrintableKey: "Unidentified"
	}, Pn = {
		8: "Backspace",
		9: "Tab",
		12: "Clear",
		13: "Enter",
		16: "Shift",
		17: "Control",
		18: "Alt",
		19: "Pause",
		20: "CapsLock",
		27: "Escape",
		32: " ",
		33: "PageUp",
		34: "PageDown",
		35: "End",
		36: "Home",
		37: "ArrowLeft",
		38: "ArrowUp",
		39: "ArrowRight",
		40: "ArrowDown",
		45: "Insert",
		46: "Delete",
		112: "F1",
		113: "F2",
		114: "F3",
		115: "F4",
		116: "F5",
		117: "F6",
		118: "F7",
		119: "F8",
		120: "F9",
		121: "F10",
		122: "F11",
		123: "F12",
		144: "NumLock",
		145: "ScrollLock",
		224: "Meta"
	}, Fn = {
		Alt: "altKey",
		Control: "ctrlKey",
		Meta: "metaKey",
		Shift: "shiftKey"
	};
	function In(e) {
		var t = this.nativeEvent;
		return t.getModifierState ? t.getModifierState(e) : (e = Fn[e]) ? !!t[e] : !1;
	}
	function Ln() {
		return In;
	}
	var Rn = vn(h({}, xn, {
		key: function(e) {
			if (e.key) {
				var t = Nn[e.key] || e.key;
				if (t !== "Unidentified") return t;
			}
			return e.type === "keypress" ? (e = hn(e), e === 13 ? "Enter" : String.fromCharCode(e)) : e.type === "keydown" || e.type === "keyup" ? Pn[e.keyCode] || "Unidentified" : "";
		},
		code: 0,
		location: 0,
		ctrlKey: 0,
		shiftKey: 0,
		altKey: 0,
		metaKey: 0,
		repeat: 0,
		locale: 0,
		getModifierState: Ln,
		charCode: function(e) {
			return e.type === "keypress" ? hn(e) : 0;
		},
		keyCode: function(e) {
			return e.type === "keydown" || e.type === "keyup" ? e.keyCode : 0;
		},
		which: function(e) {
			return e.type === "keypress" ? hn(e) : e.type === "keydown" || e.type === "keyup" ? e.keyCode : 0;
		}
	})), zn = vn(h({}, En, {
		pointerId: 0,
		width: 0,
		height: 0,
		pressure: 0,
		tangentialPressure: 0,
		tiltX: 0,
		tiltY: 0,
		twist: 0,
		pointerType: 0,
		isPrimary: 0
	})), Bn = vn(h({}, xn, {
		touches: 0,
		targetTouches: 0,
		changedTouches: 0,
		altKey: 0,
		metaKey: 0,
		ctrlKey: 0,
		shiftKey: 0,
		getModifierState: Ln
	})), Vn = vn(h({}, yn, {
		propertyName: 0,
		elapsedTime: 0,
		pseudoElement: 0
	})), Hn = vn(h({}, En, {
		deltaX: function(e) {
			return "deltaX" in e ? e.deltaX : "wheelDeltaX" in e ? -e.wheelDeltaX : 0;
		},
		deltaY: function(e) {
			return "deltaY" in e ? e.deltaY : "wheelDeltaY" in e ? -e.wheelDeltaY : "wheelDelta" in e ? -e.wheelDelta : 0;
		},
		deltaZ: 0,
		deltaMode: 0
	})), Un = vn(h({}, yn, {
		newState: 0,
		oldState: 0
	})), Wn = [
		9,
		13,
		27,
		32
	], Gn = cn && "CompositionEvent" in window, Kn = null;
	cn && "documentMode" in document && (Kn = document.documentMode);
	var qn = cn && "TextEvent" in window && !Kn, Jn = cn && (!Gn || Kn && 8 < Kn && 11 >= Kn), Yn = " ", Xn = !1;
	function Zn(e, t) {
		switch (e) {
			case "keyup": return Wn.indexOf(t.keyCode) !== -1;
			case "keydown": return t.keyCode !== 229;
			case "keypress":
			case "mousedown":
			case "focusout": return !0;
			default: return !1;
		}
	}
	function Qn(e) {
		return e = e.detail, typeof e == "object" && "data" in e ? e.data : null;
	}
	var $n = !1;
	function er(e, t) {
		switch (e) {
			case "compositionend": return Qn(t);
			case "keypress": return t.which === 32 ? (Xn = !0, Yn) : null;
			case "textInput": return e = t.data, e === Yn && Xn ? null : e;
			default: return null;
		}
	}
	function tr(e, t) {
		if ($n) return e === "compositionend" || !Gn && Zn(e, t) ? (e = mn(), pn = fn = dn = null, $n = !1, e) : null;
		switch (e) {
			case "paste": return null;
			case "keypress":
				if (!(t.ctrlKey || t.altKey || t.metaKey) || t.ctrlKey && t.altKey) {
					if (t.char && 1 < t.char.length) return t.char;
					if (t.which) return String.fromCharCode(t.which);
				}
				return null;
			case "compositionend": return Jn && t.locale !== "ko" ? null : t.data;
			default: return null;
		}
	}
	var nr = {
		color: !0,
		date: !0,
		datetime: !0,
		"datetime-local": !0,
		email: !0,
		month: !0,
		number: !0,
		password: !0,
		range: !0,
		search: !0,
		tel: !0,
		text: !0,
		time: !0,
		url: !0,
		week: !0
	};
	function rr(e) {
		var t = e && e.nodeName && e.nodeName.toLowerCase();
		return t === "input" ? !!nr[e.type] : t === "textarea";
	}
	function ir(e, t, n, r) {
		tn ? nn ? nn.push(r) : nn = [r] : tn = r, t = Ed(t, "onChange"), 0 < t.length && (n = new bn("onChange", "change", null, n, r), e.push({
			event: n,
			listeners: t
		}));
	}
	var ar = null, or = null;
	function sr(e) {
		yd(e, 0);
	}
	function cr(e) {
		if (Pt(gt(e))) return e;
	}
	function lr(e, t) {
		if (e === "change") return t;
	}
	var ur = !1;
	if (cn) {
		var dr;
		if (cn) {
			var fr = "oninput" in document;
			if (!fr) {
				var pr = document.createElement("div");
				pr.setAttribute("oninput", "return;"), fr = typeof pr.oninput == "function";
			}
			dr = fr;
		} else dr = !1;
		ur = dr && (!document.documentMode || 9 < document.documentMode);
	}
	function mr() {
		ar && (ar.detachEvent("onpropertychange", hr), or = ar = null);
	}
	function hr(e) {
		if (e.propertyName === "value" && cr(or)) {
			var t = [];
			ir(t, or, e, en(e)), on(sr, t);
		}
	}
	function gr(e, t, n) {
		e === "focusin" ? (mr(), ar = t, or = n, ar.attachEvent("onpropertychange", hr)) : e === "focusout" && mr();
	}
	function _r(e) {
		if (e === "selectionchange" || e === "keyup" || e === "keydown") return cr(or);
	}
	function vr(e, t) {
		if (e === "click") return cr(t);
	}
	function yr(e, t) {
		if (e === "input" || e === "change") return cr(t);
	}
	function br(e, t) {
		return e === t && (e !== 0 || 1 / e == 1 / t) || e !== e && t !== t;
	}
	var xr = typeof Object.is == "function" ? Object.is : br;
	function Sr(e, t) {
		if (xr(e, t)) return !0;
		if (typeof e != "object" || !e || typeof t != "object" || !t) return !1;
		var n = Object.keys(e), r = Object.keys(t);
		if (n.length !== r.length) return !1;
		for (r = 0; r < n.length; r++) {
			var i = n[r];
			if (!ye.call(t, i) || !xr(e[i], t[i])) return !1;
		}
		return !0;
	}
	function Cr(e) {
		for (; e && e.firstChild;) e = e.firstChild;
		return e;
	}
	function wr(e, t) {
		var n = Cr(e);
		e = 0;
		for (var r; n;) {
			if (n.nodeType === 3) {
				if (r = e + n.textContent.length, e <= t && r >= t) return {
					node: n,
					offset: t - e
				};
				e = r;
			}
			a: {
				for (; n;) {
					if (n.nextSibling) {
						n = n.nextSibling;
						break a;
					}
					n = n.parentNode;
				}
				n = void 0;
			}
			n = Cr(n);
		}
	}
	function Tr(e, t) {
		return e && t ? e === t ? !0 : e && e.nodeType === 3 ? !1 : t && t.nodeType === 3 ? Tr(e, t.parentNode) : "contains" in e ? e.contains(t) : e.compareDocumentPosition ? !!(e.compareDocumentPosition(t) & 16) : !1 : !1;
	}
	function Er(e) {
		e = e != null && e.ownerDocument != null && e.ownerDocument.defaultView != null ? e.ownerDocument.defaultView : window;
		for (var t = Ft(e.document); t instanceof e.HTMLIFrameElement;) {
			try {
				var n = typeof t.contentWindow.location.href == "string";
			} catch {
				n = !1;
			}
			if (n) e = t.contentWindow;
			else break;
			t = Ft(e.document);
		}
		return t;
	}
	function Dr(e) {
		var t = e && e.nodeName && e.nodeName.toLowerCase();
		return t && (t === "input" && (e.type === "text" || e.type === "search" || e.type === "tel" || e.type === "url" || e.type === "password") || t === "textarea" || e.contentEditable === "true");
	}
	var Or = cn && "documentMode" in document && 11 >= document.documentMode, kr = null, Ar = null, jr = null, Mr = !1;
	function Nr(e, t, n) {
		var r = n.window === n ? n.document : n.nodeType === 9 ? n : n.ownerDocument;
		Mr || kr == null || kr !== Ft(r) || (r = kr, "selectionStart" in r && Dr(r) ? r = {
			start: r.selectionStart,
			end: r.selectionEnd
		} : (r = (r.ownerDocument && r.ownerDocument.defaultView || window).getSelection(), r = {
			anchorNode: r.anchorNode,
			anchorOffset: r.anchorOffset,
			focusNode: r.focusNode,
			focusOffset: r.focusOffset
		}), jr && Sr(jr, r) || (jr = r, r = Ed(Ar, "onSelect"), 0 < r.length && (t = new bn("onSelect", "select", null, t, n), e.push({
			event: t,
			listeners: r
		}), t.target = kr)));
	}
	function Pr(e, t) {
		var n = {};
		return n[e.toLowerCase()] = t.toLowerCase(), n["Webkit" + e] = "webkit" + t, n["Moz" + e] = "moz" + t, n;
	}
	var Fr = {
		animationend: Pr("Animation", "AnimationEnd"),
		animationiteration: Pr("Animation", "AnimationIteration"),
		animationstart: Pr("Animation", "AnimationStart"),
		transitionrun: Pr("Transition", "TransitionRun"),
		transitionstart: Pr("Transition", "TransitionStart"),
		transitioncancel: Pr("Transition", "TransitionCancel"),
		transitionend: Pr("Transition", "TransitionEnd")
	}, Ir = {}, Lr = {};
	cn && (Lr = document.createElement("div").style, "AnimationEvent" in window || (delete Fr.animationend.animation, delete Fr.animationiteration.animation, delete Fr.animationstart.animation), "TransitionEvent" in window || delete Fr.transitionend.transition);
	function Rr(e) {
		if (Ir[e]) return Ir[e];
		if (!Fr[e]) return e;
		var t = Fr[e], n;
		for (n in t) if (t.hasOwnProperty(n) && n in Lr) return Ir[e] = t[n];
		return e;
	}
	var zr = Rr("animationend"), Br = Rr("animationiteration"), Vr = Rr("animationstart"), Hr = Rr("transitionrun"), Ur = Rr("transitionstart"), Wr = Rr("transitioncancel"), Gr = Rr("transitionend"), Kr = /* @__PURE__ */ new Map(), qr = "abort auxClick beforeToggle cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(" ");
	qr.push("scrollEnd");
	function Jr(e, t) {
		Kr.set(e, t), xt(t, [e]);
	}
	var Yr = typeof reportError == "function" ? reportError : function(e) {
		if (typeof window == "object" && typeof window.ErrorEvent == "function") {
			var t = new window.ErrorEvent("error", {
				bubbles: !0,
				cancelable: !0,
				message: typeof e == "object" && e && typeof e.message == "string" ? String(e.message) : String(e),
				error: e
			});
			if (!window.dispatchEvent(t)) return;
		} else if (typeof process == "object" && typeof process.emit == "function") {
			process.emit("uncaughtException", e);
			return;
		}
		console.error(e);
	}, Xr = [], Zr = 0, Qr = 0;
	function $r() {
		for (var e = Zr, t = Qr = Zr = 0; t < e;) {
			var n = Xr[t];
			Xr[t++] = null;
			var r = Xr[t];
			Xr[t++] = null;
			var i = Xr[t];
			Xr[t++] = null;
			var a = Xr[t];
			if (Xr[t++] = null, r !== null && i !== null) {
				var o = r.pending;
				o === null ? i.next = i : (i.next = o.next, o.next = i), r.pending = i;
			}
			a !== 0 && ri(n, i, a);
		}
	}
	function ei(e, t, n, r) {
		Xr[Zr++] = e, Xr[Zr++] = t, Xr[Zr++] = n, Xr[Zr++] = r, Qr |= r, e.lanes |= r, e = e.alternate, e !== null && (e.lanes |= r);
	}
	function ti(e, t, n, r) {
		return ei(e, t, n, r), ii(e);
	}
	function ni(e, t) {
		return ei(e, null, null, t), ii(e);
	}
	function ri(e, t, n) {
		e.lanes |= n;
		var r = e.alternate;
		r !== null && (r.lanes |= n);
		for (var i = !1, a = e.return; a !== null;) a.childLanes |= n, r = a.alternate, r !== null && (r.childLanes |= n), a.tag === 22 && (e = a.stateNode, e === null || e._visibility & 1 || (i = !0)), e = a, a = a.return;
		return e.tag === 3 ? (a = e.stateNode, i && t !== null && (i = 31 - Ie(n), e = a.hiddenUpdates, r = e[i], r === null ? e[i] = [t] : r.push(t), t.lane = n | 536870912), a) : null;
	}
	function ii(e) {
		if (50 < du) throw du = 0, fu = null, Error(i(185));
		for (var t = e.return; t !== null;) e = t, t = e.return;
		return e.tag === 3 ? e.stateNode : null;
	}
	var ai = {};
	function oi(e, t, n, r) {
		this.tag = e, this.key = n, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.refCleanup = this.ref = null, this.pendingProps = t, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = r, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null;
	}
	function si(e, t, n, r) {
		return new oi(e, t, n, r);
	}
	function ci(e) {
		return e = e.prototype, !(!e || !e.isReactComponent);
	}
	function li(e, t) {
		var n = e.alternate;
		return n === null ? (n = si(e.tag, t, e.key, e.mode), n.elementType = e.elementType, n.type = e.type, n.stateNode = e.stateNode, n.alternate = e, e.alternate = n) : (n.pendingProps = t, n.type = e.type, n.flags = 0, n.subtreeFlags = 0, n.deletions = null), n.flags = e.flags & 65011712, n.childLanes = e.childLanes, n.lanes = e.lanes, n.child = e.child, n.memoizedProps = e.memoizedProps, n.memoizedState = e.memoizedState, n.updateQueue = e.updateQueue, t = e.dependencies, n.dependencies = t === null ? null : {
			lanes: t.lanes,
			firstContext: t.firstContext
		}, n.sibling = e.sibling, n.index = e.index, n.ref = e.ref, n.refCleanup = e.refCleanup, n;
	}
	function ui(e, t) {
		e.flags &= 65011714;
		var n = e.alternate;
		return n === null ? (e.childLanes = 0, e.lanes = t, e.child = null, e.subtreeFlags = 0, e.memoizedProps = null, e.memoizedState = null, e.updateQueue = null, e.dependencies = null, e.stateNode = null) : (e.childLanes = n.childLanes, e.lanes = n.lanes, e.child = n.child, e.subtreeFlags = 0, e.deletions = null, e.memoizedProps = n.memoizedProps, e.memoizedState = n.memoizedState, e.updateQueue = n.updateQueue, e.type = n.type, t = n.dependencies, e.dependencies = t === null ? null : {
			lanes: t.lanes,
			firstContext: t.firstContext
		}), e;
	}
	function di(e, t, n, r, a, o) {
		var s = 0;
		if (r = e, typeof e == "function") ci(e) && (s = 1);
		else if (typeof e == "string") s = Uf(e, n, ae.current) ? 26 : e === "html" || e === "head" || e === "body" ? 27 : 5;
		else a: switch (e) {
			case te: return e = si(31, n, t, a), e.elementType = te, e.lanes = o, e;
			case y: return fi(n.children, a, o, t);
			case b:
				s = 8, a |= 24;
				break;
			case x: return e = si(12, n, t, a | 2), e.elementType = x, e.lanes = o, e;
			case T: return e = si(13, n, t, a), e.elementType = T, e.lanes = o, e;
			case E: return e = si(19, n, t, a), e.elementType = E, e.lanes = o, e;
			default:
				if (typeof e == "object" && e) switch (e.$$typeof) {
					case C:
						s = 10;
						break a;
					case S:
						s = 9;
						break a;
					case w:
						s = 11;
						break a;
					case ee:
						s = 14;
						break a;
					case D:
						s = 16, r = null;
						break a;
				}
				s = 29, n = Error(i(130, e === null ? "null" : typeof e, "")), r = null;
		}
		return t = si(s, n, t, a), t.elementType = e, t.type = r, t.lanes = o, t;
	}
	function fi(e, t, n, r) {
		return e = si(7, e, r, t), e.lanes = n, e;
	}
	function pi(e, t, n) {
		return e = si(6, e, null, t), e.lanes = n, e;
	}
	function mi(e) {
		var t = si(18, null, null, 0);
		return t.stateNode = e, t;
	}
	function hi(e, t, n) {
		return t = si(4, e.children === null ? [] : e.children, e.key, t), t.lanes = n, t.stateNode = {
			containerInfo: e.containerInfo,
			pendingChildren: null,
			implementation: e.implementation
		}, t;
	}
	var gi = /* @__PURE__ */ new WeakMap();
	function _i(e, t) {
		if (typeof e == "object" && e) {
			var n = gi.get(e);
			return n === void 0 ? (t = {
				value: e,
				source: t,
				stack: ve(t)
			}, gi.set(e, t), t) : n;
		}
		return {
			value: e,
			source: t,
			stack: ve(t)
		};
	}
	var vi = [], yi = 0, bi = null, xi = 0, Si = [], Ci = 0, wi = null, Ti = 1, Ei = "";
	function Di(e, t) {
		vi[yi++] = xi, vi[yi++] = bi, bi = e, xi = t;
	}
	function Oi(e, t, n) {
		Si[Ci++] = Ti, Si[Ci++] = Ei, Si[Ci++] = wi, wi = e;
		var r = Ti;
		e = Ei;
		var i = 32 - Ie(r) - 1;
		r &= ~(1 << i), n += 1;
		var a = 32 - Ie(t) + i;
		if (30 < a) {
			var o = i - i % 5;
			a = (r & (1 << o) - 1).toString(32), r >>= o, i -= o, Ti = 1 << 32 - Ie(t) + i | n << i | r, Ei = a + e;
		} else Ti = 1 << a | n << i | r, Ei = e;
	}
	function ki(e) {
		e.return !== null && (Di(e, 1), Oi(e, 1, 0));
	}
	function Ai(e) {
		for (; e === bi;) bi = vi[--yi], vi[yi] = null, xi = vi[--yi], vi[yi] = null;
		for (; e === wi;) wi = Si[--Ci], Si[Ci] = null, Ei = Si[--Ci], Si[Ci] = null, Ti = Si[--Ci], Si[Ci] = null;
	}
	function ji(e, t) {
		Si[Ci++] = Ti, Si[Ci++] = Ei, Si[Ci++] = wi, Ti = t.id, Ei = t.overflow, wi = e;
	}
	var Mi = null, B = null, V = !1, Ni = null, Pi = !1, Fi = Error(i(519));
	function Ii(e) {
		throw Hi(_i(Error(i(418, 1 < arguments.length && arguments[1] !== void 0 && arguments[1] ? "text" : "HTML", "")), e)), Fi;
	}
	function Li(e) {
		var t = e.stateNode, n = e.type, r = e.memoizedProps;
		switch (t[at] = e, t[ot] = r, n) {
			case "dialog":
				Q("cancel", t), Q("close", t);
				break;
			case "iframe":
			case "object":
			case "embed":
				Q("load", t);
				break;
			case "video":
			case "audio":
				for (n = 0; n < _d.length; n++) Q(_d[n], t);
				break;
			case "source":
				Q("error", t);
				break;
			case "img":
			case "image":
			case "link":
				Q("error", t), Q("load", t);
				break;
			case "details":
				Q("toggle", t);
				break;
			case "input":
				Q("invalid", t), zt(t, r.value, r.defaultValue, r.checked, r.defaultChecked, r.type, r.name, !0);
				break;
			case "select":
				Q("invalid", t);
				break;
			case "textarea": Q("invalid", t), Ut(t, r.value, r.defaultValue, r.children);
		}
		n = r.children, typeof n != "string" && typeof n != "number" && typeof n != "bigint" || t.textContent === "" + n || !0 === r.suppressHydrationWarning || Md(t.textContent, n) ? (r.popover != null && (Q("beforetoggle", t), Q("toggle", t)), r.onScroll != null && Q("scroll", t), r.onScrollEnd != null && Q("scrollend", t), r.onClick != null && (t.onclick = Qt), t = !0) : t = !1, t || Ii(e, !0);
	}
	function Ri(e) {
		for (Mi = e.return; Mi;) switch (Mi.tag) {
			case 5:
			case 31:
			case 13:
				Pi = !1;
				return;
			case 27:
			case 3:
				Pi = !0;
				return;
			default: Mi = Mi.return;
		}
	}
	function zi(e) {
		if (e !== Mi) return !1;
		if (!V) return Ri(e), V = !0, !1;
		var t = e.tag, n;
		if ((n = t !== 3 && t !== 27) && ((n = t === 5) && (n = e.type, n = !(n !== "form" && n !== "button") || Ud(e.type, e.memoizedProps)), n = !n), n && B && Ii(e), Ri(e), t === 13) {
			if (e = e.memoizedState, e = e === null ? null : e.dehydrated, !e) throw Error(i(317));
			B = uf(e);
		} else if (t === 31) {
			if (e = e.memoizedState, e = e === null ? null : e.dehydrated, !e) throw Error(i(317));
			B = uf(e);
		} else t === 27 ? (t = B, Zd(e.type) ? (e = lf, lf = null, B = e) : B = t) : B = Mi ? cf(e.stateNode.nextSibling) : null;
		return !0;
	}
	function Bi() {
		B = Mi = null, V = !1;
	}
	function Vi() {
		var e = Ni;
		return e !== null && (Zl === null ? Zl = e : Zl.push.apply(Zl, e), Ni = null), e;
	}
	function Hi(e) {
		Ni === null ? Ni = [e] : Ni.push(e);
	}
	var Ui = ie(null), Wi = null, Gi = null;
	function Ki(e, t, n) {
		R(Ui, t._currentValue), t._currentValue = n;
	}
	function qi(e) {
		e._currentValue = Ui.current, L(Ui);
	}
	function Ji(e, t, n) {
		for (; e !== null;) {
			var r = e.alternate;
			if ((e.childLanes & t) === t ? r !== null && (r.childLanes & t) !== t && (r.childLanes |= t) : (e.childLanes |= t, r !== null && (r.childLanes |= t)), e === n) break;
			e = e.return;
		}
	}
	function Yi(e, t, n, r) {
		var a = e.child;
		for (a !== null && (a.return = e); a !== null;) {
			var o = a.dependencies;
			if (o !== null) {
				var s = a.child;
				o = o.firstContext;
				a: for (; o !== null;) {
					var c = o;
					o = a;
					for (var l = 0; l < t.length; l++) if (c.context === t[l]) {
						o.lanes |= n, c = o.alternate, c !== null && (c.lanes |= n), Ji(o.return, n, e), r || (s = null);
						break a;
					}
					o = c.next;
				}
			} else if (a.tag === 18) {
				if (s = a.return, s === null) throw Error(i(341));
				s.lanes |= n, o = s.alternate, o !== null && (o.lanes |= n), Ji(s, n, e), s = null;
			} else s = a.child;
			if (s !== null) s.return = a;
			else for (s = a; s !== null;) {
				if (s === e) {
					s = null;
					break;
				}
				if (a = s.sibling, a !== null) {
					a.return = s.return, s = a;
					break;
				}
				s = s.return;
			}
			a = s;
		}
	}
	function Xi(e, t, n, r) {
		e = null;
		for (var a = t, o = !1; a !== null;) {
			if (!o) {
				if (a.flags & 524288) o = !0;
				else if (a.flags & 262144) break;
			}
			if (a.tag === 10) {
				var s = a.alternate;
				if (s === null) throw Error(i(387));
				if (s = s.memoizedProps, s !== null) {
					var c = a.type;
					xr(a.pendingProps.value, s.value) || (e === null ? e = [c] : e.push(c));
				}
			} else if (a === se.current) {
				if (s = a.alternate, s === null) throw Error(i(387));
				s.memoizedState.memoizedState !== a.memoizedState.memoizedState && (e === null ? e = [Qf] : e.push(Qf));
			}
			a = a.return;
		}
		e !== null && Yi(t, e, n, r), t.flags |= 262144;
	}
	function Zi(e) {
		for (e = e.firstContext; e !== null;) {
			if (!xr(e.context._currentValue, e.memoizedValue)) return !0;
			e = e.next;
		}
		return !1;
	}
	function Qi(e) {
		Wi = e, Gi = null, e = e.dependencies, e !== null && (e.firstContext = null);
	}
	function $i(e) {
		return ta(Wi, e);
	}
	function ea(e, t) {
		return Wi === null && Qi(e), ta(e, t);
	}
	function ta(e, t) {
		var n = t._currentValue;
		if (t = {
			context: t,
			memoizedValue: n,
			next: null
		}, Gi === null) {
			if (e === null) throw Error(i(308));
			Gi = t, e.dependencies = {
				lanes: 0,
				firstContext: t
			}, e.flags |= 524288;
		} else Gi = Gi.next = t;
		return n;
	}
	var na = typeof AbortController < "u" ? AbortController : function() {
		var e = [], t = this.signal = {
			aborted: !1,
			addEventListener: function(t, n) {
				e.push(n);
			}
		};
		this.abort = function() {
			t.aborted = !0, e.forEach(function(e) {
				return e();
			});
		};
	}, ra = t.unstable_scheduleCallback, ia = t.unstable_NormalPriority, aa = {
		$$typeof: C,
		Consumer: null,
		Provider: null,
		_currentValue: null,
		_currentValue2: null,
		_threadCount: 0
	};
	function oa() {
		return {
			controller: new na(),
			data: /* @__PURE__ */ new Map(),
			refCount: 0
		};
	}
	function sa(e) {
		e.refCount--, e.refCount === 0 && ra(ia, function() {
			e.controller.abort();
		});
	}
	var ca = null, la = 0, ua = 0, da = null;
	function fa(e, t) {
		if (ca === null) {
			var n = ca = [];
			la = 0, ua = dd(), da = {
				status: "pending",
				value: void 0,
				then: function(e) {
					n.push(e);
				}
			};
		}
		return la++, t.then(pa, pa), t;
	}
	function pa() {
		if (--la === 0 && ca !== null) {
			da !== null && (da.status = "fulfilled");
			var e = ca;
			ca = null, ua = 0, da = null;
			for (var t = 0; t < e.length; t++) (0, e[t])();
		}
	}
	function ma(e, t) {
		var n = [], r = {
			status: "pending",
			value: null,
			reason: null,
			then: function(e) {
				n.push(e);
			}
		};
		return e.then(function() {
			r.status = "fulfilled", r.value = t;
			for (var e = 0; e < n.length; e++) (0, n[e])(t);
		}, function(e) {
			for (r.status = "rejected", r.reason = e, e = 0; e < n.length; e++) (0, n[e])(void 0);
		}), r;
	}
	var ha = P.S;
	P.S = function(e, t) {
		eu = we(), typeof t == "object" && t && typeof t.then == "function" && fa(e, t), ha !== null && ha(e, t);
	};
	var ga = ie(null);
	function _a() {
		var e = ga.current;
		return e === null ? q.pooledCache : e;
	}
	function va(e, t) {
		t === null ? R(ga, ga.current) : R(ga, t.pool);
	}
	function ya() {
		var e = _a();
		return e === null ? null : {
			parent: aa._currentValue,
			pool: e
		};
	}
	var ba = Error(i(460)), xa = Error(i(474)), Sa = Error(i(542)), Ca = { then: function() {} };
	function wa(e) {
		return e = e.status, e === "fulfilled" || e === "rejected";
	}
	function Ta(e, t, n) {
		switch (n = e[n], n === void 0 ? e.push(t) : n !== t && (t.then(Qt, Qt), t = n), t.status) {
			case "fulfilled": return t.value;
			case "rejected": throw e = t.reason, ka(e), e;
			default:
				if (typeof t.status == "string") t.then(Qt, Qt);
				else {
					if (e = q, e !== null && 100 < e.shellSuspendCounter) throw Error(i(482));
					e = t, e.status = "pending", e.then(function(e) {
						if (t.status === "pending") {
							var n = t;
							n.status = "fulfilled", n.value = e;
						}
					}, function(e) {
						if (t.status === "pending") {
							var n = t;
							n.status = "rejected", n.reason = e;
						}
					});
				}
				switch (t.status) {
					case "fulfilled": return t.value;
					case "rejected": throw e = t.reason, ka(e), e;
				}
				throw Da = t, ba;
		}
	}
	function Ea(e) {
		try {
			var t = e._init;
			return t(e._payload);
		} catch (e) {
			throw typeof e == "object" && e && typeof e.then == "function" ? (Da = e, ba) : e;
		}
	}
	var Da = null;
	function Oa() {
		if (Da === null) throw Error(i(459));
		var e = Da;
		return Da = null, e;
	}
	function ka(e) {
		if (e === ba || e === Sa) throw Error(i(483));
	}
	var Aa = null, ja = 0;
	function Ma(e) {
		var t = ja;
		return ja += 1, Aa === null && (Aa = []), Ta(Aa, e, t);
	}
	function Na(e, t) {
		t = t.props.ref, e.ref = t === void 0 ? null : t;
	}
	function Pa(e, t) {
		throw t.$$typeof === g ? Error(i(525)) : (e = Object.prototype.toString.call(t), Error(i(31, e === "[object Object]" ? "object with keys {" + Object.keys(t).join(", ") + "}" : e)));
	}
	function Fa(e) {
		function t(t, n) {
			if (e) {
				var r = t.deletions;
				r === null ? (t.deletions = [n], t.flags |= 16) : r.push(n);
			}
		}
		function n(n, r) {
			if (!e) return null;
			for (; r !== null;) t(n, r), r = r.sibling;
			return null;
		}
		function r(e) {
			for (var t = /* @__PURE__ */ new Map(); e !== null;) e.key === null ? t.set(e.index, e) : t.set(e.key, e), e = e.sibling;
			return t;
		}
		function a(e, t) {
			return e = li(e, t), e.index = 0, e.sibling = null, e;
		}
		function o(t, n, r) {
			return t.index = r, e ? (r = t.alternate, r === null ? (t.flags |= 67108866, n) : (r = r.index, r < n ? (t.flags |= 67108866, n) : r)) : (t.flags |= 1048576, n);
		}
		function s(t) {
			return e && t.alternate === null && (t.flags |= 67108866), t;
		}
		function c(e, t, n, r) {
			return t === null || t.tag !== 6 ? (t = pi(n, e.mode, r), t.return = e, t) : (t = a(t, n), t.return = e, t);
		}
		function l(e, t, n, r) {
			var i = n.type;
			return i === y ? d(e, t, n.props.children, r, n.key) : t !== null && (t.elementType === i || typeof i == "object" && i && i.$$typeof === D && Ea(i) === t.type) ? (t = a(t, n.props), Na(t, n), t.return = e, t) : (t = di(n.type, n.key, n.props, null, e.mode, r), Na(t, n), t.return = e, t);
		}
		function u(e, t, n, r) {
			return t === null || t.tag !== 4 || t.stateNode.containerInfo !== n.containerInfo || t.stateNode.implementation !== n.implementation ? (t = hi(n, e.mode, r), t.return = e, t) : (t = a(t, n.children || []), t.return = e, t);
		}
		function d(e, t, n, r, i) {
			return t === null || t.tag !== 7 ? (t = fi(n, e.mode, r, i), t.return = e, t) : (t = a(t, n), t.return = e, t);
		}
		function f(e, t, n) {
			if (typeof t == "string" && t !== "" || typeof t == "number" || typeof t == "bigint") return t = pi("" + t, e.mode, n), t.return = e, t;
			if (typeof t == "object" && t) {
				switch (t.$$typeof) {
					case _: return n = di(t.type, t.key, t.props, null, e.mode, n), Na(n, t), n.return = e, n;
					case v: return t = hi(t, e.mode, n), t.return = e, t;
					case D: return t = Ea(t), f(e, t, n);
				}
				if (N(t) || A(t)) return t = fi(t, e.mode, n, null), t.return = e, t;
				if (typeof t.then == "function") return f(e, Ma(t), n);
				if (t.$$typeof === C) return f(e, ea(e, t), n);
				Pa(e, t);
			}
			return null;
		}
		function p(e, t, n, r) {
			var i = t === null ? null : t.key;
			if (typeof n == "string" && n !== "" || typeof n == "number" || typeof n == "bigint") return i === null ? c(e, t, "" + n, r) : null;
			if (typeof n == "object" && n) {
				switch (n.$$typeof) {
					case _: return n.key === i ? l(e, t, n, r) : null;
					case v: return n.key === i ? u(e, t, n, r) : null;
					case D: return n = Ea(n), p(e, t, n, r);
				}
				if (N(n) || A(n)) return i === null ? d(e, t, n, r, null) : null;
				if (typeof n.then == "function") return p(e, t, Ma(n), r);
				if (n.$$typeof === C) return p(e, t, ea(e, n), r);
				Pa(e, n);
			}
			return null;
		}
		function m(e, t, n, r, i) {
			if (typeof r == "string" && r !== "" || typeof r == "number" || typeof r == "bigint") return e = e.get(n) || null, c(t, e, "" + r, i);
			if (typeof r == "object" && r) {
				switch (r.$$typeof) {
					case _: return e = e.get(r.key === null ? n : r.key) || null, l(t, e, r, i);
					case v: return e = e.get(r.key === null ? n : r.key) || null, u(t, e, r, i);
					case D: return r = Ea(r), m(e, t, n, r, i);
				}
				if (N(r) || A(r)) return e = e.get(n) || null, d(t, e, r, i, null);
				if (typeof r.then == "function") return m(e, t, n, Ma(r), i);
				if (r.$$typeof === C) return m(e, t, n, ea(t, r), i);
				Pa(t, r);
			}
			return null;
		}
		function h(i, a, s, c) {
			for (var l = null, u = null, d = a, h = a = 0, g = null; d !== null && h < s.length; h++) {
				d.index > h ? (g = d, d = null) : g = d.sibling;
				var _ = p(i, d, s[h], c);
				if (_ === null) {
					d === null && (d = g);
					break;
				}
				e && d && _.alternate === null && t(i, d), a = o(_, a, h), u === null ? l = _ : u.sibling = _, u = _, d = g;
			}
			if (h === s.length) return n(i, d), V && Di(i, h), l;
			if (d === null) {
				for (; h < s.length; h++) d = f(i, s[h], c), d !== null && (a = o(d, a, h), u === null ? l = d : u.sibling = d, u = d);
				return V && Di(i, h), l;
			}
			for (d = r(d); h < s.length; h++) g = m(d, i, h, s[h], c), g !== null && (e && g.alternate !== null && d.delete(g.key === null ? h : g.key), a = o(g, a, h), u === null ? l = g : u.sibling = g, u = g);
			return e && d.forEach(function(e) {
				return t(i, e);
			}), V && Di(i, h), l;
		}
		function g(a, s, c, l) {
			if (c == null) throw Error(i(151));
			for (var u = null, d = null, h = s, g = s = 0, _ = null, v = c.next(); h !== null && !v.done; g++, v = c.next()) {
				h.index > g ? (_ = h, h = null) : _ = h.sibling;
				var y = p(a, h, v.value, l);
				if (y === null) {
					h === null && (h = _);
					break;
				}
				e && h && y.alternate === null && t(a, h), s = o(y, s, g), d === null ? u = y : d.sibling = y, d = y, h = _;
			}
			if (v.done) return n(a, h), V && Di(a, g), u;
			if (h === null) {
				for (; !v.done; g++, v = c.next()) v = f(a, v.value, l), v !== null && (s = o(v, s, g), d === null ? u = v : d.sibling = v, d = v);
				return V && Di(a, g), u;
			}
			for (h = r(h); !v.done; g++, v = c.next()) v = m(h, a, g, v.value, l), v !== null && (e && v.alternate !== null && h.delete(v.key === null ? g : v.key), s = o(v, s, g), d === null ? u = v : d.sibling = v, d = v);
			return e && h.forEach(function(e) {
				return t(a, e);
			}), V && Di(a, g), u;
		}
		function b(e, r, o, c) {
			if (typeof o == "object" && o && o.type === y && o.key === null && (o = o.props.children), typeof o == "object" && o) {
				switch (o.$$typeof) {
					case _:
						a: {
							for (var l = o.key; r !== null;) {
								if (r.key === l) {
									if (l = o.type, l === y) {
										if (r.tag === 7) {
											n(e, r.sibling), c = a(r, o.props.children), c.return = e, e = c;
											break a;
										}
									} else if (r.elementType === l || typeof l == "object" && l && l.$$typeof === D && Ea(l) === r.type) {
										n(e, r.sibling), c = a(r, o.props), Na(c, o), c.return = e, e = c;
										break a;
									}
									n(e, r);
									break;
								} else t(e, r);
								r = r.sibling;
							}
							o.type === y ? (c = fi(o.props.children, e.mode, c, o.key), c.return = e, e = c) : (c = di(o.type, o.key, o.props, null, e.mode, c), Na(c, o), c.return = e, e = c);
						}
						return s(e);
					case v:
						a: {
							for (l = o.key; r !== null;) {
								if (r.key === l) if (r.tag === 4 && r.stateNode.containerInfo === o.containerInfo && r.stateNode.implementation === o.implementation) {
									n(e, r.sibling), c = a(r, o.children || []), c.return = e, e = c;
									break a;
								} else {
									n(e, r);
									break;
								}
								else t(e, r);
								r = r.sibling;
							}
							c = hi(o, e.mode, c), c.return = e, e = c;
						}
						return s(e);
					case D: return o = Ea(o), b(e, r, o, c);
				}
				if (N(o)) return h(e, r, o, c);
				if (A(o)) {
					if (l = A(o), typeof l != "function") throw Error(i(150));
					return o = l.call(o), g(e, r, o, c);
				}
				if (typeof o.then == "function") return b(e, r, Ma(o), c);
				if (o.$$typeof === C) return b(e, r, ea(e, o), c);
				Pa(e, o);
			}
			return typeof o == "string" && o !== "" || typeof o == "number" || typeof o == "bigint" ? (o = "" + o, r !== null && r.tag === 6 ? (n(e, r.sibling), c = a(r, o), c.return = e, e = c) : (n(e, r), c = pi(o, e.mode, c), c.return = e, e = c), s(e)) : n(e, r);
		}
		return function(e, t, n, r) {
			try {
				ja = 0;
				var i = b(e, t, n, r);
				return Aa = null, i;
			} catch (t) {
				if (t === ba || t === Sa) throw t;
				var a = si(29, t, null, e.mode);
				return a.lanes = r, a.return = e, a;
			}
		};
	}
	var Ia = Fa(!0), La = Fa(!1), Ra = !1;
	function za(e) {
		e.updateQueue = {
			baseState: e.memoizedState,
			firstBaseUpdate: null,
			lastBaseUpdate: null,
			shared: {
				pending: null,
				lanes: 0,
				hiddenCallbacks: null
			},
			callbacks: null
		};
	}
	function Ba(e, t) {
		e = e.updateQueue, t.updateQueue === e && (t.updateQueue = {
			baseState: e.baseState,
			firstBaseUpdate: e.firstBaseUpdate,
			lastBaseUpdate: e.lastBaseUpdate,
			shared: e.shared,
			callbacks: null
		});
	}
	function Va(e) {
		return {
			lane: e,
			tag: 0,
			payload: null,
			callback: null,
			next: null
		};
	}
	function Ha(e, t, n) {
		var r = e.updateQueue;
		if (r === null) return null;
		if (r = r.shared, K & 2) {
			var i = r.pending;
			return i === null ? t.next = t : (t.next = i.next, i.next = t), r.pending = t, t = ii(e), ri(e, null, n), t;
		}
		return ei(e, r, t, n), ii(e);
	}
	function Ua(e, t, n) {
		if (t = t.updateQueue, t !== null && (t = t.shared, n & 4194048)) {
			var r = t.lanes;
			r &= e.pendingLanes, n |= r, t.lanes = n, Qe(e, n);
		}
	}
	function Wa(e, t) {
		var n = e.updateQueue, r = e.alternate;
		if (r !== null && (r = r.updateQueue, n === r)) {
			var i = null, a = null;
			if (n = n.firstBaseUpdate, n !== null) {
				do {
					var o = {
						lane: n.lane,
						tag: n.tag,
						payload: n.payload,
						callback: null,
						next: null
					};
					a === null ? i = a = o : a = a.next = o, n = n.next;
				} while (n !== null);
				a === null ? i = a = t : a = a.next = t;
			} else i = a = t;
			n = {
				baseState: r.baseState,
				firstBaseUpdate: i,
				lastBaseUpdate: a,
				shared: r.shared,
				callbacks: r.callbacks
			}, e.updateQueue = n;
			return;
		}
		e = n.lastBaseUpdate, e === null ? n.firstBaseUpdate = t : e.next = t, n.lastBaseUpdate = t;
	}
	var Ga = !1;
	function Ka() {
		if (Ga) {
			var e = da;
			if (e !== null) throw e;
		}
	}
	function qa(e, t, n, r) {
		Ga = !1;
		var i = e.updateQueue;
		Ra = !1;
		var a = i.firstBaseUpdate, o = i.lastBaseUpdate, s = i.shared.pending;
		if (s !== null) {
			i.shared.pending = null;
			var c = s, l = c.next;
			c.next = null, o === null ? a = l : o.next = l, o = c;
			var u = e.alternate;
			u !== null && (u = u.updateQueue, s = u.lastBaseUpdate, s !== o && (s === null ? u.firstBaseUpdate = l : s.next = l, u.lastBaseUpdate = c));
		}
		if (a !== null) {
			var d = i.baseState;
			o = 0, u = l = c = null, s = a;
			do {
				var f = s.lane & -536870913, p = f !== s.lane;
				if (p ? (Y & f) === f : (r & f) === f) {
					f !== 0 && f === ua && (Ga = !0), u !== null && (u = u.next = {
						lane: 0,
						tag: s.tag,
						payload: s.payload,
						callback: null,
						next: null
					});
					a: {
						var m = e, g = s;
						f = t;
						var _ = n;
						switch (g.tag) {
							case 1:
								if (m = g.payload, typeof m == "function") {
									d = m.call(_, d, f);
									break a;
								}
								d = m;
								break a;
							case 3: m.flags = m.flags & -65537 | 128;
							case 0:
								if (m = g.payload, f = typeof m == "function" ? m.call(_, d, f) : m, f == null) break a;
								d = h({}, d, f);
								break a;
							case 2: Ra = !0;
						}
					}
					f = s.callback, f !== null && (e.flags |= 64, p && (e.flags |= 8192), p = i.callbacks, p === null ? i.callbacks = [f] : p.push(f));
				} else p = {
					lane: f,
					tag: s.tag,
					payload: s.payload,
					callback: s.callback,
					next: null
				}, u === null ? (l = u = p, c = d) : u = u.next = p, o |= f;
				if (s = s.next, s === null) {
					if (s = i.shared.pending, s === null) break;
					p = s, s = p.next, p.next = null, i.lastBaseUpdate = p, i.shared.pending = null;
				}
			} while (1);
			u === null && (c = d), i.baseState = c, i.firstBaseUpdate = l, i.lastBaseUpdate = u, a === null && (i.shared.lanes = 0), Gl |= o, e.lanes = o, e.memoizedState = d;
		}
	}
	function Ja(e, t) {
		if (typeof e != "function") throw Error(i(191, e));
		e.call(t);
	}
	function Ya(e, t) {
		var n = e.callbacks;
		if (n !== null) for (e.callbacks = null, e = 0; e < n.length; e++) Ja(n[e], t);
	}
	var Xa = ie(null), Za = ie(0);
	function Qa(e, t) {
		e = Ul, R(Za, e), R(Xa, t), Ul = e | t.baseLanes;
	}
	function $a() {
		R(Za, Ul), R(Xa, Xa.current);
	}
	function eo() {
		Ul = Za.current, L(Xa), L(Za);
	}
	var to = ie(null), no = null;
	function ro(e) {
		var t = e.alternate;
		R(co, co.current & 1), R(to, e), no === null && (t === null || Xa.current !== null || t.memoizedState !== null) && (no = e);
	}
	function io(e) {
		R(co, co.current), R(to, e), no === null && (no = e);
	}
	function ao(e) {
		e.tag === 22 ? (R(co, co.current), R(to, e), no === null && (no = e)) : oo(e);
	}
	function oo() {
		R(co, co.current), R(to, to.current);
	}
	function so(e) {
		L(to), no === e && (no = null), L(co);
	}
	var co = ie(0);
	function lo(e) {
		for (var t = e; t !== null;) {
			if (t.tag === 13) {
				var n = t.memoizedState;
				if (n !== null && (n = n.dehydrated, n === null || af(n) || of(n))) return t;
			} else if (t.tag === 19 && (t.memoizedProps.revealOrder === "forwards" || t.memoizedProps.revealOrder === "backwards" || t.memoizedProps.revealOrder === "unstable_legacy-backwards" || t.memoizedProps.revealOrder === "together")) {
				if (t.flags & 128) return t;
			} else if (t.child !== null) {
				t.child.return = t, t = t.child;
				continue;
			}
			if (t === e) break;
			for (; t.sibling === null;) {
				if (t.return === null || t.return === e) return null;
				t = t.return;
			}
			t.sibling.return = t.return, t = t.sibling;
		}
		return null;
	}
	var uo = 0, H = null, U = null, fo = null, po = !1, mo = !1, ho = !1, go = 0, _o = 0, vo = null, yo = 0;
	function bo() {
		throw Error(i(321));
	}
	function xo(e, t) {
		if (t === null) return !1;
		for (var n = 0; n < t.length && n < e.length; n++) if (!xr(e[n], t[n])) return !1;
		return !0;
	}
	function So(e, t, n, r, i, a) {
		return uo = a, H = t, t.memoizedState = null, t.updateQueue = null, t.lanes = 0, P.H = e === null || e.memoizedState === null ? zs : Bs, ho = !1, a = n(r, i), ho = !1, mo && (a = wo(t, n, r, i)), Co(e), a;
	}
	function Co(e) {
		P.H = Rs;
		var t = U !== null && U.next !== null;
		if (uo = 0, fo = U = H = null, po = !1, _o = 0, vo = null, t) throw Error(i(300));
		e === null || rc || (e = e.dependencies, e !== null && Zi(e) && (rc = !0));
	}
	function wo(e, t, n, r) {
		H = e;
		var a = 0;
		do {
			if (mo && (vo = null), _o = 0, mo = !1, 25 <= a) throw Error(i(301));
			if (a += 1, fo = U = null, e.updateQueue != null) {
				var o = e.updateQueue;
				o.lastEffect = null, o.events = null, o.stores = null, o.memoCache != null && (o.memoCache.index = 0);
			}
			P.H = Vs, o = t(n, r);
		} while (mo);
		return o;
	}
	function To() {
		var e = P.H, t = e.useState()[0];
		return t = typeof t.then == "function" ? Mo(t) : t, e = e.useState()[0], (U === null ? null : U.memoizedState) !== e && (H.flags |= 1024), t;
	}
	function Eo() {
		var e = go !== 0;
		return go = 0, e;
	}
	function Do(e, t, n) {
		t.updateQueue = e.updateQueue, t.flags &= -2053, e.lanes &= ~n;
	}
	function Oo(e) {
		if (po) {
			for (e = e.memoizedState; e !== null;) {
				var t = e.queue;
				t !== null && (t.pending = null), e = e.next;
			}
			po = !1;
		}
		uo = 0, fo = U = H = null, mo = !1, _o = go = 0, vo = null;
	}
	function ko() {
		var e = {
			memoizedState: null,
			baseState: null,
			baseQueue: null,
			queue: null,
			next: null
		};
		return fo === null ? H.memoizedState = fo = e : fo = fo.next = e, fo;
	}
	function Ao() {
		if (U === null) {
			var e = H.alternate;
			e = e === null ? null : e.memoizedState;
		} else e = U.next;
		var t = fo === null ? H.memoizedState : fo.next;
		if (t !== null) fo = t, U = e;
		else {
			if (e === null) throw H.alternate === null ? Error(i(467)) : Error(i(310));
			U = e, e = {
				memoizedState: U.memoizedState,
				baseState: U.baseState,
				baseQueue: U.baseQueue,
				queue: U.queue,
				next: null
			}, fo === null ? H.memoizedState = fo = e : fo = fo.next = e;
		}
		return fo;
	}
	function jo() {
		return {
			lastEffect: null,
			events: null,
			stores: null,
			memoCache: null
		};
	}
	function Mo(e) {
		var t = _o;
		return _o += 1, vo === null && (vo = []), e = Ta(vo, e, t), t = H, (fo === null ? t.memoizedState : fo.next) === null && (t = t.alternate, P.H = t === null || t.memoizedState === null ? zs : Bs), e;
	}
	function No(e) {
		if (typeof e == "object" && e) {
			if (typeof e.then == "function") return Mo(e);
			if (e.$$typeof === C) return $i(e);
		}
		throw Error(i(438, String(e)));
	}
	function Po(e) {
		var t = null, n = H.updateQueue;
		if (n !== null && (t = n.memoCache), t == null) {
			var r = H.alternate;
			r !== null && (r = r.updateQueue, r !== null && (r = r.memoCache, r != null && (t = {
				data: r.data.map(function(e) {
					return e.slice();
				}),
				index: 0
			})));
		}
		if (t ??= {
			data: [],
			index: 0
		}, n === null && (n = jo(), H.updateQueue = n), n.memoCache = t, n = t.data[t.index], n === void 0) for (n = t.data[t.index] = Array(e), r = 0; r < e; r++) n[r] = O;
		return t.index++, n;
	}
	function Fo(e, t) {
		return typeof t == "function" ? t(e) : t;
	}
	function Io(e) {
		return Lo(Ao(), U, e);
	}
	function Lo(e, t, n) {
		var r = e.queue;
		if (r === null) throw Error(i(311));
		r.lastRenderedReducer = n;
		var a = e.baseQueue, o = r.pending;
		if (o !== null) {
			if (a !== null) {
				var s = a.next;
				a.next = o.next, o.next = s;
			}
			t.baseQueue = a = o, r.pending = null;
		}
		if (o = e.baseState, a === null) e.memoizedState = o;
		else {
			t = a.next;
			var c = s = null, l = null, u = t, d = !1;
			do {
				var f = u.lane & -536870913;
				if (f === u.lane ? (uo & f) === f : (Y & f) === f) {
					var p = u.revertLane;
					if (p === 0) l !== null && (l = l.next = {
						lane: 0,
						revertLane: 0,
						gesture: null,
						action: u.action,
						hasEagerState: u.hasEagerState,
						eagerState: u.eagerState,
						next: null
					}), f === ua && (d = !0);
					else if ((uo & p) === p) {
						u = u.next, p === ua && (d = !0);
						continue;
					} else f = {
						lane: 0,
						revertLane: u.revertLane,
						gesture: null,
						action: u.action,
						hasEagerState: u.hasEagerState,
						eagerState: u.eagerState,
						next: null
					}, l === null ? (c = l = f, s = o) : l = l.next = f, H.lanes |= p, Gl |= p;
					f = u.action, ho && n(o, f), o = u.hasEagerState ? u.eagerState : n(o, f);
				} else p = {
					lane: f,
					revertLane: u.revertLane,
					gesture: u.gesture,
					action: u.action,
					hasEagerState: u.hasEagerState,
					eagerState: u.eagerState,
					next: null
				}, l === null ? (c = l = p, s = o) : l = l.next = p, H.lanes |= f, Gl |= f;
				u = u.next;
			} while (u !== null && u !== t);
			if (l === null ? s = o : l.next = c, !xr(o, e.memoizedState) && (rc = !0, d && (n = da, n !== null))) throw n;
			e.memoizedState = o, e.baseState = s, e.baseQueue = l, r.lastRenderedState = o;
		}
		return a === null && (r.lanes = 0), [e.memoizedState, r.dispatch];
	}
	function Ro(e) {
		var t = Ao(), n = t.queue;
		if (n === null) throw Error(i(311));
		n.lastRenderedReducer = e;
		var r = n.dispatch, a = n.pending, o = t.memoizedState;
		if (a !== null) {
			n.pending = null;
			var s = a = a.next;
			do
				o = e(o, s.action), s = s.next;
			while (s !== a);
			xr(o, t.memoizedState) || (rc = !0), t.memoizedState = o, t.baseQueue === null && (t.baseState = o), n.lastRenderedState = o;
		}
		return [o, r];
	}
	function zo(e, t, n) {
		var r = H, a = Ao(), o = V;
		if (o) {
			if (n === void 0) throw Error(i(407));
			n = n();
		} else n = t();
		var s = !xr((U || a).memoizedState, n);
		if (s && (a.memoizedState = n, rc = !0), a = a.queue, us(Ho.bind(null, r, a, e), [e]), a.getSnapshot !== t || s || fo !== null && fo.memoizedState.tag & 1) {
			if (r.flags |= 2048, as(9, { destroy: void 0 }, Vo.bind(null, r, a, n, t), null), q === null) throw Error(i(349));
			o || uo & 127 || Bo(r, t, n);
		}
		return n;
	}
	function Bo(e, t, n) {
		e.flags |= 16384, e = {
			getSnapshot: t,
			value: n
		}, t = H.updateQueue, t === null ? (t = jo(), H.updateQueue = t, t.stores = [e]) : (n = t.stores, n === null ? t.stores = [e] : n.push(e));
	}
	function Vo(e, t, n, r) {
		t.value = n, t.getSnapshot = r, Uo(t) && Wo(e);
	}
	function Ho(e, t, n) {
		return n(function() {
			Uo(t) && Wo(e);
		});
	}
	function Uo(e) {
		var t = e.getSnapshot;
		e = e.value;
		try {
			var n = t();
			return !xr(e, n);
		} catch {
			return !0;
		}
	}
	function Wo(e) {
		var t = ni(e, 2);
		t !== null && hu(t, e, 2);
	}
	function Go(e) {
		var t = ko();
		if (typeof e == "function") {
			var n = e;
			if (e = n(), ho) {
				Fe(!0);
				try {
					n();
				} finally {
					Fe(!1);
				}
			}
		}
		return t.memoizedState = t.baseState = e, t.queue = {
			pending: null,
			lanes: 0,
			dispatch: null,
			lastRenderedReducer: Fo,
			lastRenderedState: e
		}, t;
	}
	function Ko(e, t, n, r) {
		return e.baseState = n, Lo(e, U, typeof r == "function" ? r : Fo);
	}
	function qo(e, t, n, r, a) {
		if (Fs(e)) throw Error(i(485));
		if (e = t.action, e !== null) {
			var o = {
				payload: a,
				action: e,
				next: null,
				isTransition: !0,
				status: "pending",
				value: null,
				reason: null,
				listeners: [],
				then: function(e) {
					o.listeners.push(e);
				}
			};
			P.T === null ? o.isTransition = !1 : n(!0), r(o), n = t.pending, n === null ? (o.next = t.pending = o, Jo(t, o)) : (o.next = n.next, t.pending = n.next = o);
		}
	}
	function Jo(e, t) {
		var n = t.action, r = t.payload, i = e.state;
		if (t.isTransition) {
			var a = P.T, o = {};
			P.T = o;
			try {
				var s = n(i, r), c = P.S;
				c !== null && c(o, s), Yo(e, t, s);
			} catch (n) {
				Zo(e, t, n);
			} finally {
				a !== null && o.types !== null && (a.types = o.types), P.T = a;
			}
		} else try {
			a = n(i, r), Yo(e, t, a);
		} catch (n) {
			Zo(e, t, n);
		}
	}
	function Yo(e, t, n) {
		typeof n == "object" && n && typeof n.then == "function" ? n.then(function(n) {
			Xo(e, t, n);
		}, function(n) {
			return Zo(e, t, n);
		}) : Xo(e, t, n);
	}
	function Xo(e, t, n) {
		t.status = "fulfilled", t.value = n, Qo(t), e.state = n, t = e.pending, t !== null && (n = t.next, n === t ? e.pending = null : (n = n.next, t.next = n, Jo(e, n)));
	}
	function Zo(e, t, n) {
		var r = e.pending;
		if (e.pending = null, r !== null) {
			r = r.next;
			do
				t.status = "rejected", t.reason = n, Qo(t), t = t.next;
			while (t !== r);
		}
		e.action = null;
	}
	function Qo(e) {
		e = e.listeners;
		for (var t = 0; t < e.length; t++) (0, e[t])();
	}
	function $o(e, t) {
		return t;
	}
	function es(e, t) {
		if (V) {
			var n = q.formState;
			if (n !== null) {
				a: {
					var r = H;
					if (V) {
						if (B) {
							b: {
								for (var i = B, a = Pi; i.nodeType !== 8;) {
									if (!a) {
										i = null;
										break b;
									}
									if (i = cf(i.nextSibling), i === null) {
										i = null;
										break b;
									}
								}
								a = i.data, i = a === "F!" || a === "F" ? i : null;
							}
							if (i) {
								B = cf(i.nextSibling), r = i.data === "F!";
								break a;
							}
						}
						Ii(r);
					}
					r = !1;
				}
				r && (t = n[0]);
			}
		}
		return n = ko(), n.memoizedState = n.baseState = t, r = {
			pending: null,
			lanes: 0,
			dispatch: null,
			lastRenderedReducer: $o,
			lastRenderedState: t
		}, n.queue = r, n = Ms.bind(null, H, r), r.dispatch = n, r = Go(!1), a = Ps.bind(null, H, !1, r.queue), r = ko(), i = {
			state: t,
			dispatch: null,
			action: e,
			pending: null
		}, r.queue = i, n = qo.bind(null, H, i, a, n), i.dispatch = n, r.memoizedState = e, [
			t,
			n,
			!1
		];
	}
	function ts(e) {
		return ns(Ao(), U, e);
	}
	function ns(e, t, n) {
		if (t = Lo(e, t, $o)[0], e = Io(Fo)[0], typeof t == "object" && t && typeof t.then == "function") try {
			var r = Mo(t);
		} catch (e) {
			throw e === ba ? Sa : e;
		}
		else r = t;
		t = Ao();
		var i = t.queue, a = i.dispatch;
		return n !== t.memoizedState && (H.flags |= 2048, as(9, { destroy: void 0 }, rs.bind(null, i, n), null)), [
			r,
			a,
			e
		];
	}
	function rs(e, t) {
		e.action = t;
	}
	function is(e) {
		var t = Ao(), n = U;
		if (n !== null) return ns(t, n, e);
		Ao(), t = t.memoizedState, n = Ao();
		var r = n.queue.dispatch;
		return n.memoizedState = e, [
			t,
			r,
			!1
		];
	}
	function as(e, t, n, r) {
		return e = {
			tag: e,
			create: n,
			deps: r,
			inst: t,
			next: null
		}, t = H.updateQueue, t === null && (t = jo(), H.updateQueue = t), n = t.lastEffect, n === null ? t.lastEffect = e.next = e : (r = n.next, n.next = e, e.next = r, t.lastEffect = e), e;
	}
	function os() {
		return Ao().memoizedState;
	}
	function ss(e, t, n, r) {
		var i = ko();
		H.flags |= e, i.memoizedState = as(1 | t, { destroy: void 0 }, n, r === void 0 ? null : r);
	}
	function cs(e, t, n, r) {
		var i = Ao();
		r = r === void 0 ? null : r;
		var a = i.memoizedState.inst;
		U !== null && r !== null && xo(r, U.memoizedState.deps) ? i.memoizedState = as(t, a, n, r) : (H.flags |= e, i.memoizedState = as(1 | t, a, n, r));
	}
	function ls(e, t) {
		ss(8390656, 8, e, t);
	}
	function us(e, t) {
		cs(2048, 8, e, t);
	}
	function ds(e) {
		H.flags |= 4;
		var t = H.updateQueue;
		if (t === null) t = jo(), H.updateQueue = t, t.events = [e];
		else {
			var n = t.events;
			n === null ? t.events = [e] : n.push(e);
		}
	}
	function fs(e) {
		var t = Ao().memoizedState;
		return ds({
			ref: t,
			nextImpl: e
		}), function() {
			if (K & 2) throw Error(i(440));
			return t.impl.apply(void 0, arguments);
		};
	}
	function ps(e, t) {
		return cs(4, 2, e, t);
	}
	function ms(e, t) {
		return cs(4, 4, e, t);
	}
	function hs(e, t) {
		if (typeof t == "function") {
			e = e();
			var n = t(e);
			return function() {
				typeof n == "function" ? n() : t(null);
			};
		}
		if (t != null) return e = e(), t.current = e, function() {
			t.current = null;
		};
	}
	function gs(e, t, n) {
		n = n == null ? null : n.concat([e]), cs(4, 4, hs.bind(null, t, e), n);
	}
	function _s() {}
	function vs(e, t) {
		var n = Ao();
		t = t === void 0 ? null : t;
		var r = n.memoizedState;
		return t !== null && xo(t, r[1]) ? r[0] : (n.memoizedState = [e, t], e);
	}
	function ys(e, t) {
		var n = Ao();
		t = t === void 0 ? null : t;
		var r = n.memoizedState;
		if (t !== null && xo(t, r[1])) return r[0];
		if (r = e(), ho) {
			Fe(!0);
			try {
				e();
			} finally {
				Fe(!1);
			}
		}
		return n.memoizedState = [r, t], r;
	}
	function bs(e, t, n) {
		return n === void 0 || uo & 1073741824 && !(Y & 261930) ? e.memoizedState = t : (e.memoizedState = n, e = mu(), H.lanes |= e, Gl |= e, n);
	}
	function xs(e, t, n, r) {
		return xr(n, t) ? n : Xa.current === null ? !(uo & 42) || uo & 1073741824 && !(Y & 261930) ? (rc = !0, e.memoizedState = n) : (e = mu(), H.lanes |= e, Gl |= e, t) : (e = bs(e, n, r), xr(e, t) || (rc = !0), e);
	}
	function Ss(e, t, n, r, i) {
		var a = F.p;
		F.p = a !== 0 && 8 > a ? a : 8;
		var o = P.T, s = {};
		P.T = s, Ps(e, !1, t, n);
		try {
			var c = i(), l = P.S;
			l !== null && l(s, c), typeof c == "object" && c && typeof c.then == "function" ? Ns(e, t, ma(c, r), pu(e)) : Ns(e, t, r, pu(e));
		} catch (n) {
			Ns(e, t, {
				then: function() {},
				status: "rejected",
				reason: n
			}, pu());
		} finally {
			F.p = a, o !== null && s.types !== null && (o.types = s.types), P.T = o;
		}
	}
	function Cs() {}
	function ws(e, t, n, r) {
		if (e.tag !== 5) throw Error(i(476));
		var a = Ts(e).queue;
		Ss(e, a, t, I, n === null ? Cs : function() {
			return Es(e), n(r);
		});
	}
	function Ts(e) {
		var t = e.memoizedState;
		if (t !== null) return t;
		t = {
			memoizedState: I,
			baseState: I,
			baseQueue: null,
			queue: {
				pending: null,
				lanes: 0,
				dispatch: null,
				lastRenderedReducer: Fo,
				lastRenderedState: I
			},
			next: null
		};
		var n = {};
		return t.next = {
			memoizedState: n,
			baseState: n,
			baseQueue: null,
			queue: {
				pending: null,
				lanes: 0,
				dispatch: null,
				lastRenderedReducer: Fo,
				lastRenderedState: n
			},
			next: null
		}, e.memoizedState = t, e = e.alternate, e !== null && (e.memoizedState = t), t;
	}
	function Es(e) {
		var t = Ts(e);
		t.next === null && (t = e.alternate.memoizedState), Ns(e, t.next.queue, {}, pu());
	}
	function Ds() {
		return $i(Qf);
	}
	function Os() {
		return Ao().memoizedState;
	}
	function ks() {
		return Ao().memoizedState;
	}
	function As(e) {
		for (var t = e.return; t !== null;) {
			switch (t.tag) {
				case 24:
				case 3:
					var n = pu();
					e = Va(n);
					var r = Ha(t, e, n);
					r !== null && (hu(r, t, n), Ua(r, t, n)), t = { cache: oa() }, e.payload = t;
					return;
			}
			t = t.return;
		}
	}
	function js(e, t, n) {
		var r = pu();
		n = {
			lane: r,
			revertLane: 0,
			gesture: null,
			action: n,
			hasEagerState: !1,
			eagerState: null,
			next: null
		}, Fs(e) ? Is(t, n) : (n = ti(e, t, n, r), n !== null && (hu(n, e, r), Ls(n, t, r)));
	}
	function Ms(e, t, n) {
		Ns(e, t, n, pu());
	}
	function Ns(e, t, n, r) {
		var i = {
			lane: r,
			revertLane: 0,
			gesture: null,
			action: n,
			hasEagerState: !1,
			eagerState: null,
			next: null
		};
		if (Fs(e)) Is(t, i);
		else {
			var a = e.alternate;
			if (e.lanes === 0 && (a === null || a.lanes === 0) && (a = t.lastRenderedReducer, a !== null)) try {
				var o = t.lastRenderedState, s = a(o, n);
				if (i.hasEagerState = !0, i.eagerState = s, xr(s, o)) return ei(e, t, i, 0), q === null && $r(), !1;
			} catch {}
			if (n = ti(e, t, i, r), n !== null) return hu(n, e, r), Ls(n, t, r), !0;
		}
		return !1;
	}
	function Ps(e, t, n, r) {
		if (r = {
			lane: 2,
			revertLane: dd(),
			gesture: null,
			action: r,
			hasEagerState: !1,
			eagerState: null,
			next: null
		}, Fs(e)) {
			if (t) throw Error(i(479));
		} else t = ti(e, n, r, 2), t !== null && hu(t, e, 2);
	}
	function Fs(e) {
		var t = e.alternate;
		return e === H || t !== null && t === H;
	}
	function Is(e, t) {
		mo = po = !0;
		var n = e.pending;
		n === null ? t.next = t : (t.next = n.next, n.next = t), e.pending = t;
	}
	function Ls(e, t, n) {
		if (n & 4194048) {
			var r = t.lanes;
			r &= e.pendingLanes, n |= r, t.lanes = n, Qe(e, n);
		}
	}
	var Rs = {
		readContext: $i,
		use: No,
		useCallback: bo,
		useContext: bo,
		useEffect: bo,
		useImperativeHandle: bo,
		useLayoutEffect: bo,
		useInsertionEffect: bo,
		useMemo: bo,
		useReducer: bo,
		useRef: bo,
		useState: bo,
		useDebugValue: bo,
		useDeferredValue: bo,
		useTransition: bo,
		useSyncExternalStore: bo,
		useId: bo,
		useHostTransitionStatus: bo,
		useFormState: bo,
		useActionState: bo,
		useOptimistic: bo,
		useMemoCache: bo,
		useCacheRefresh: bo
	};
	Rs.useEffectEvent = bo;
	var zs = {
		readContext: $i,
		use: No,
		useCallback: function(e, t) {
			return ko().memoizedState = [e, t === void 0 ? null : t], e;
		},
		useContext: $i,
		useEffect: ls,
		useImperativeHandle: function(e, t, n) {
			n = n == null ? null : n.concat([e]), ss(4194308, 4, hs.bind(null, t, e), n);
		},
		useLayoutEffect: function(e, t) {
			return ss(4194308, 4, e, t);
		},
		useInsertionEffect: function(e, t) {
			ss(4, 2, e, t);
		},
		useMemo: function(e, t) {
			var n = ko();
			t = t === void 0 ? null : t;
			var r = e();
			if (ho) {
				Fe(!0);
				try {
					e();
				} finally {
					Fe(!1);
				}
			}
			return n.memoizedState = [r, t], r;
		},
		useReducer: function(e, t, n) {
			var r = ko();
			if (n !== void 0) {
				var i = n(t);
				if (ho) {
					Fe(!0);
					try {
						n(t);
					} finally {
						Fe(!1);
					}
				}
			} else i = t;
			return r.memoizedState = r.baseState = i, e = {
				pending: null,
				lanes: 0,
				dispatch: null,
				lastRenderedReducer: e,
				lastRenderedState: i
			}, r.queue = e, e = e.dispatch = js.bind(null, H, e), [r.memoizedState, e];
		},
		useRef: function(e) {
			var t = ko();
			return e = { current: e }, t.memoizedState = e;
		},
		useState: function(e) {
			e = Go(e);
			var t = e.queue, n = Ms.bind(null, H, t);
			return t.dispatch = n, [e.memoizedState, n];
		},
		useDebugValue: _s,
		useDeferredValue: function(e, t) {
			return bs(ko(), e, t);
		},
		useTransition: function() {
			var e = Go(!1);
			return e = Ss.bind(null, H, e.queue, !0, !1), ko().memoizedState = e, [!1, e];
		},
		useSyncExternalStore: function(e, t, n) {
			var r = H, a = ko();
			if (V) {
				if (n === void 0) throw Error(i(407));
				n = n();
			} else {
				if (n = t(), q === null) throw Error(i(349));
				Y & 127 || Bo(r, t, n);
			}
			a.memoizedState = n;
			var o = {
				value: n,
				getSnapshot: t
			};
			return a.queue = o, ls(Ho.bind(null, r, o, e), [e]), r.flags |= 2048, as(9, { destroy: void 0 }, Vo.bind(null, r, o, n, t), null), n;
		},
		useId: function() {
			var e = ko(), t = q.identifierPrefix;
			if (V) {
				var n = Ei, r = Ti;
				n = (r & ~(1 << 32 - Ie(r) - 1)).toString(32) + n, t = "_" + t + "R_" + n, n = go++, 0 < n && (t += "H" + n.toString(32)), t += "_";
			} else n = yo++, t = "_" + t + "r_" + n.toString(32) + "_";
			return e.memoizedState = t;
		},
		useHostTransitionStatus: Ds,
		useFormState: es,
		useActionState: es,
		useOptimistic: function(e) {
			var t = ko();
			t.memoizedState = t.baseState = e;
			var n = {
				pending: null,
				lanes: 0,
				dispatch: null,
				lastRenderedReducer: null,
				lastRenderedState: null
			};
			return t.queue = n, t = Ps.bind(null, H, !0, n), n.dispatch = t, [e, t];
		},
		useMemoCache: Po,
		useCacheRefresh: function() {
			return ko().memoizedState = As.bind(null, H);
		},
		useEffectEvent: function(e) {
			var t = ko(), n = { impl: e };
			return t.memoizedState = n, function() {
				if (K & 2) throw Error(i(440));
				return n.impl.apply(void 0, arguments);
			};
		}
	}, Bs = {
		readContext: $i,
		use: No,
		useCallback: vs,
		useContext: $i,
		useEffect: us,
		useImperativeHandle: gs,
		useInsertionEffect: ps,
		useLayoutEffect: ms,
		useMemo: ys,
		useReducer: Io,
		useRef: os,
		useState: function() {
			return Io(Fo);
		},
		useDebugValue: _s,
		useDeferredValue: function(e, t) {
			return xs(Ao(), U.memoizedState, e, t);
		},
		useTransition: function() {
			var e = Io(Fo)[0], t = Ao().memoizedState;
			return [typeof e == "boolean" ? e : Mo(e), t];
		},
		useSyncExternalStore: zo,
		useId: Os,
		useHostTransitionStatus: Ds,
		useFormState: ts,
		useActionState: ts,
		useOptimistic: function(e, t) {
			return Ko(Ao(), U, e, t);
		},
		useMemoCache: Po,
		useCacheRefresh: ks
	};
	Bs.useEffectEvent = fs;
	var Vs = {
		readContext: $i,
		use: No,
		useCallback: vs,
		useContext: $i,
		useEffect: us,
		useImperativeHandle: gs,
		useInsertionEffect: ps,
		useLayoutEffect: ms,
		useMemo: ys,
		useReducer: Ro,
		useRef: os,
		useState: function() {
			return Ro(Fo);
		},
		useDebugValue: _s,
		useDeferredValue: function(e, t) {
			var n = Ao();
			return U === null ? bs(n, e, t) : xs(n, U.memoizedState, e, t);
		},
		useTransition: function() {
			var e = Ro(Fo)[0], t = Ao().memoizedState;
			return [typeof e == "boolean" ? e : Mo(e), t];
		},
		useSyncExternalStore: zo,
		useId: Os,
		useHostTransitionStatus: Ds,
		useFormState: is,
		useActionState: is,
		useOptimistic: function(e, t) {
			var n = Ao();
			return U === null ? (n.baseState = e, [e, n.queue.dispatch]) : Ko(n, U, e, t);
		},
		useMemoCache: Po,
		useCacheRefresh: ks
	};
	Vs.useEffectEvent = fs;
	function Hs(e, t, n, r) {
		t = e.memoizedState, n = n(r, t), n = n == null ? t : h({}, t, n), e.memoizedState = n, e.lanes === 0 && (e.updateQueue.baseState = n);
	}
	var Us = {
		enqueueSetState: function(e, t, n) {
			e = e._reactInternals;
			var r = pu(), i = Va(r);
			i.payload = t, n != null && (i.callback = n), t = Ha(e, i, r), t !== null && (hu(t, e, r), Ua(t, e, r));
		},
		enqueueReplaceState: function(e, t, n) {
			e = e._reactInternals;
			var r = pu(), i = Va(r);
			i.tag = 1, i.payload = t, n != null && (i.callback = n), t = Ha(e, i, r), t !== null && (hu(t, e, r), Ua(t, e, r));
		},
		enqueueForceUpdate: function(e, t) {
			e = e._reactInternals;
			var n = pu(), r = Va(n);
			r.tag = 2, t != null && (r.callback = t), t = Ha(e, r, n), t !== null && (hu(t, e, n), Ua(t, e, n));
		}
	};
	function Ws(e, t, n, r, i, a, o) {
		return e = e.stateNode, typeof e.shouldComponentUpdate == "function" ? e.shouldComponentUpdate(r, a, o) : t.prototype && t.prototype.isPureReactComponent ? !Sr(n, r) || !Sr(i, a) : !0;
	}
	function Gs(e, t, n, r) {
		e = t.state, typeof t.componentWillReceiveProps == "function" && t.componentWillReceiveProps(n, r), typeof t.UNSAFE_componentWillReceiveProps == "function" && t.UNSAFE_componentWillReceiveProps(n, r), t.state !== e && Us.enqueueReplaceState(t, t.state, null);
	}
	function Ks(e, t) {
		var n = t;
		if ("ref" in t) for (var r in n = {}, t) r !== "ref" && (n[r] = t[r]);
		if (e = e.defaultProps) for (var i in n === t && (n = h({}, n)), e) n[i] === void 0 && (n[i] = e[i]);
		return n;
	}
	function qs(e) {
		Yr(e);
	}
	function Js(e) {
		console.error(e);
	}
	function Ys(e) {
		Yr(e);
	}
	function Xs(e, t) {
		try {
			var n = e.onUncaughtError;
			n(t.value, { componentStack: t.stack });
		} catch (e) {
			setTimeout(function() {
				throw e;
			});
		}
	}
	function Zs(e, t, n) {
		try {
			var r = e.onCaughtError;
			r(n.value, {
				componentStack: n.stack,
				errorBoundary: t.tag === 1 ? t.stateNode : null
			});
		} catch (e) {
			setTimeout(function() {
				throw e;
			});
		}
	}
	function Qs(e, t, n) {
		return n = Va(n), n.tag = 3, n.payload = { element: null }, n.callback = function() {
			Xs(e, t);
		}, n;
	}
	function $s(e) {
		return e = Va(e), e.tag = 3, e;
	}
	function ec(e, t, n, r) {
		var i = n.type.getDerivedStateFromError;
		if (typeof i == "function") {
			var a = r.value;
			e.payload = function() {
				return i(a);
			}, e.callback = function() {
				Zs(t, n, r);
			};
		}
		var o = n.stateNode;
		o !== null && typeof o.componentDidCatch == "function" && (e.callback = function() {
			Zs(t, n, r), typeof i != "function" && (ru === null ? ru = /* @__PURE__ */ new Set([this]) : ru.add(this));
			var e = r.stack;
			this.componentDidCatch(r.value, { componentStack: e === null ? "" : e });
		});
	}
	function tc(e, t, n, r, a) {
		if (n.flags |= 32768, typeof r == "object" && r && typeof r.then == "function") {
			if (t = n.alternate, t !== null && Xi(t, n, a, !0), n = to.current, n !== null) {
				switch (n.tag) {
					case 31:
					case 13: return no === null ? Du() : n.alternate === null && Wl === 0 && (Wl = 3), n.flags &= -257, n.flags |= 65536, n.lanes = a, r === Ca ? n.flags |= 16384 : (t = n.updateQueue, t === null ? n.updateQueue = /* @__PURE__ */ new Set([r]) : t.add(r), Gu(e, r, a)), !1;
					case 22: return n.flags |= 65536, r === Ca ? n.flags |= 16384 : (t = n.updateQueue, t === null ? (t = {
						transitions: null,
						markerInstances: null,
						retryQueue: /* @__PURE__ */ new Set([r])
					}, n.updateQueue = t) : (n = t.retryQueue, n === null ? t.retryQueue = /* @__PURE__ */ new Set([r]) : n.add(r)), Gu(e, r, a)), !1;
				}
				throw Error(i(435, n.tag));
			}
			return Gu(e, r, a), Du(), !1;
		}
		if (V) return t = to.current, t === null ? (r !== Fi && (t = Error(i(423), { cause: r }), Hi(_i(t, n))), e = e.current.alternate, e.flags |= 65536, a &= -a, e.lanes |= a, r = _i(r, n), a = Qs(e.stateNode, r, a), Wa(e, a), Wl !== 4 && (Wl = 2)) : (!(t.flags & 65536) && (t.flags |= 256), t.flags |= 65536, t.lanes = a, r !== Fi && (e = Error(i(422), { cause: r }), Hi(_i(e, n)))), !1;
		var o = Error(i(520), { cause: r });
		if (o = _i(o, n), Xl === null ? Xl = [o] : Xl.push(o), Wl !== 4 && (Wl = 2), t === null) return !0;
		r = _i(r, n), n = t;
		do {
			switch (n.tag) {
				case 3: return n.flags |= 65536, e = a & -a, n.lanes |= e, e = Qs(n.stateNode, r, e), Wa(n, e), !1;
				case 1: if (t = n.type, o = n.stateNode, !(n.flags & 128) && (typeof t.getDerivedStateFromError == "function" || o !== null && typeof o.componentDidCatch == "function" && (ru === null || !ru.has(o)))) return n.flags |= 65536, a &= -a, n.lanes |= a, a = $s(a), ec(a, e, n, r), Wa(n, a), !1;
			}
			n = n.return;
		} while (n !== null);
		return !1;
	}
	var nc = Error(i(461)), rc = !1;
	function ic(e, t, n, r) {
		t.child = e === null ? La(t, null, n, r) : Ia(t, e.child, n, r);
	}
	function ac(e, t, n, r, i) {
		n = n.render;
		var a = t.ref;
		if ("ref" in r) {
			var o = {};
			for (var s in r) s !== "ref" && (o[s] = r[s]);
		} else o = r;
		return Qi(t), r = So(e, t, n, o, a, i), s = Eo(), e !== null && !rc ? (Do(e, t, i), kc(e, t, i)) : (V && s && ki(t), t.flags |= 1, ic(e, t, r, i), t.child);
	}
	function oc(e, t, n, r, i) {
		if (e === null) {
			var a = n.type;
			return typeof a == "function" && !ci(a) && a.defaultProps === void 0 && n.compare === null ? (t.tag = 15, t.type = a, sc(e, t, a, r, i)) : (e = di(n.type, null, r, t, t.mode, i), e.ref = t.ref, e.return = t, t.child = e);
		}
		if (a = e.child, !Ac(e, i)) {
			var o = a.memoizedProps;
			if (n = n.compare, n = n === null ? Sr : n, n(o, r) && e.ref === t.ref) return kc(e, t, i);
		}
		return t.flags |= 1, e = li(a, r), e.ref = t.ref, e.return = t, t.child = e;
	}
	function sc(e, t, n, r, i) {
		if (e !== null) {
			var a = e.memoizedProps;
			if (Sr(a, r) && e.ref === t.ref) if (rc = !1, t.pendingProps = r = a, Ac(e, i)) e.flags & 131072 && (rc = !0);
			else return t.lanes = e.lanes, kc(e, t, i);
		}
		return hc(e, t, n, r, i);
	}
	function cc(e, t, n, r) {
		var i = r.children, a = e === null ? null : e.memoizedState;
		if (e === null && t.stateNode === null && (t.stateNode = {
			_visibility: 1,
			_pendingMarkers: null,
			_retryCache: null,
			_transitions: null
		}), r.mode === "hidden") {
			if (t.flags & 128) {
				if (a = a === null ? n : a.baseLanes | n, e !== null) {
					for (r = t.child = e.child, i = 0; r !== null;) i = i | r.lanes | r.childLanes, r = r.sibling;
					r = i & ~a;
				} else r = 0, t.child = null;
				return uc(e, t, a, n, r);
			}
			if (n & 536870912) t.memoizedState = {
				baseLanes: 0,
				cachePool: null
			}, e !== null && va(t, a === null ? null : a.cachePool), a === null ? $a() : Qa(t, a), ao(t);
			else return r = t.lanes = 536870912, uc(e, t, a === null ? n : a.baseLanes | n, n, r);
		} else a === null ? (e !== null && va(t, null), $a(), oo(t)) : (va(t, a.cachePool), Qa(t, a), oo(t), t.memoizedState = null);
		return ic(e, t, i, n), t.child;
	}
	function lc(e, t) {
		return e !== null && e.tag === 22 || t.stateNode !== null || (t.stateNode = {
			_visibility: 1,
			_pendingMarkers: null,
			_retryCache: null,
			_transitions: null
		}), t.sibling;
	}
	function uc(e, t, n, r, i) {
		var a = _a();
		return a = a === null ? null : {
			parent: aa._currentValue,
			pool: a
		}, t.memoizedState = {
			baseLanes: n,
			cachePool: a
		}, e !== null && va(t, null), $a(), ao(t), e !== null && Xi(e, t, r, !0), t.childLanes = i, null;
	}
	function dc(e, t) {
		return t = wc({
			mode: t.mode,
			children: t.children
		}, e.mode), t.ref = e.ref, e.child = t, t.return = e, t;
	}
	function fc(e, t, n) {
		return Ia(t, e.child, null, n), e = dc(t, t.pendingProps), e.flags |= 2, so(t), t.memoizedState = null, e;
	}
	function pc(e, t, n) {
		var r = t.pendingProps, a = (t.flags & 128) != 0;
		if (t.flags &= -129, e === null) {
			if (V) {
				if (r.mode === "hidden") return e = dc(t, r), t.lanes = 536870912, lc(null, e);
				if (io(t), (e = B) ? (e = rf(e, Pi), e = e !== null && e.data === "&" ? e : null, e !== null && (t.memoizedState = {
					dehydrated: e,
					treeContext: wi === null ? null : {
						id: Ti,
						overflow: Ei
					},
					retryLane: 536870912,
					hydrationErrors: null
				}, n = mi(e), n.return = t, t.child = n, Mi = t, B = null)) : e = null, e === null) throw Ii(t);
				return t.lanes = 536870912, null;
			}
			return dc(t, r);
		}
		var o = e.memoizedState;
		if (o !== null) {
			var s = o.dehydrated;
			if (io(t), a) if (t.flags & 256) t.flags &= -257, t = fc(e, t, n);
			else if (t.memoizedState !== null) t.child = e.child, t.flags |= 128, t = null;
			else throw Error(i(558));
			else if (rc || Xi(e, t, n, !1), a = (n & e.childLanes) !== 0, rc || a) {
				if (r = q, r !== null && (s = $e(r, n), s !== 0 && s !== o.retryLane)) throw o.retryLane = s, ni(e, s), hu(r, e, s), nc;
				Du(), t = fc(e, t, n);
			} else e = o.treeContext, B = cf(s.nextSibling), Mi = t, V = !0, Ni = null, Pi = !1, e !== null && ji(t, e), t = dc(t, r), t.flags |= 4096;
			return t;
		}
		return e = li(e.child, {
			mode: r.mode,
			children: r.children
		}), e.ref = t.ref, t.child = e, e.return = t, e;
	}
	function mc(e, t) {
		var n = t.ref;
		if (n === null) e !== null && e.ref !== null && (t.flags |= 4194816);
		else {
			if (typeof n != "function" && typeof n != "object") throw Error(i(284));
			(e === null || e.ref !== n) && (t.flags |= 4194816);
		}
	}
	function hc(e, t, n, r, i) {
		return Qi(t), n = So(e, t, n, r, void 0, i), r = Eo(), e !== null && !rc ? (Do(e, t, i), kc(e, t, i)) : (V && r && ki(t), t.flags |= 1, ic(e, t, n, i), t.child);
	}
	function gc(e, t, n, r, i, a) {
		return Qi(t), t.updateQueue = null, n = wo(t, r, n, i), Co(e), r = Eo(), e !== null && !rc ? (Do(e, t, a), kc(e, t, a)) : (V && r && ki(t), t.flags |= 1, ic(e, t, n, a), t.child);
	}
	function _c(e, t, n, r, i) {
		if (Qi(t), t.stateNode === null) {
			var a = ai, o = n.contextType;
			typeof o == "object" && o && (a = $i(o)), a = new n(r, a), t.memoizedState = a.state !== null && a.state !== void 0 ? a.state : null, a.updater = Us, t.stateNode = a, a._reactInternals = t, a = t.stateNode, a.props = r, a.state = t.memoizedState, a.refs = {}, za(t), o = n.contextType, a.context = typeof o == "object" && o ? $i(o) : ai, a.state = t.memoizedState, o = n.getDerivedStateFromProps, typeof o == "function" && (Hs(t, n, o, r), a.state = t.memoizedState), typeof n.getDerivedStateFromProps == "function" || typeof a.getSnapshotBeforeUpdate == "function" || typeof a.UNSAFE_componentWillMount != "function" && typeof a.componentWillMount != "function" || (o = a.state, typeof a.componentWillMount == "function" && a.componentWillMount(), typeof a.UNSAFE_componentWillMount == "function" && a.UNSAFE_componentWillMount(), o !== a.state && Us.enqueueReplaceState(a, a.state, null), qa(t, r, a, i), Ka(), a.state = t.memoizedState), typeof a.componentDidMount == "function" && (t.flags |= 4194308), r = !0;
		} else if (e === null) {
			a = t.stateNode;
			var s = t.memoizedProps, c = Ks(n, s);
			a.props = c;
			var l = a.context, u = n.contextType;
			o = ai, typeof u == "object" && u && (o = $i(u));
			var d = n.getDerivedStateFromProps;
			u = typeof d == "function" || typeof a.getSnapshotBeforeUpdate == "function", s = t.pendingProps !== s, u || typeof a.UNSAFE_componentWillReceiveProps != "function" && typeof a.componentWillReceiveProps != "function" || (s || l !== o) && Gs(t, a, r, o), Ra = !1;
			var f = t.memoizedState;
			a.state = f, qa(t, r, a, i), Ka(), l = t.memoizedState, s || f !== l || Ra ? (typeof d == "function" && (Hs(t, n, d, r), l = t.memoizedState), (c = Ra || Ws(t, n, c, r, f, l, o)) ? (u || typeof a.UNSAFE_componentWillMount != "function" && typeof a.componentWillMount != "function" || (typeof a.componentWillMount == "function" && a.componentWillMount(), typeof a.UNSAFE_componentWillMount == "function" && a.UNSAFE_componentWillMount()), typeof a.componentDidMount == "function" && (t.flags |= 4194308)) : (typeof a.componentDidMount == "function" && (t.flags |= 4194308), t.memoizedProps = r, t.memoizedState = l), a.props = r, a.state = l, a.context = o, r = c) : (typeof a.componentDidMount == "function" && (t.flags |= 4194308), r = !1);
		} else {
			a = t.stateNode, Ba(e, t), o = t.memoizedProps, u = Ks(n, o), a.props = u, d = t.pendingProps, f = a.context, l = n.contextType, c = ai, typeof l == "object" && l && (c = $i(l)), s = n.getDerivedStateFromProps, (l = typeof s == "function" || typeof a.getSnapshotBeforeUpdate == "function") || typeof a.UNSAFE_componentWillReceiveProps != "function" && typeof a.componentWillReceiveProps != "function" || (o !== d || f !== c) && Gs(t, a, r, c), Ra = !1, f = t.memoizedState, a.state = f, qa(t, r, a, i), Ka();
			var p = t.memoizedState;
			o !== d || f !== p || Ra || e !== null && e.dependencies !== null && Zi(e.dependencies) ? (typeof s == "function" && (Hs(t, n, s, r), p = t.memoizedState), (u = Ra || Ws(t, n, u, r, f, p, c) || e !== null && e.dependencies !== null && Zi(e.dependencies)) ? (l || typeof a.UNSAFE_componentWillUpdate != "function" && typeof a.componentWillUpdate != "function" || (typeof a.componentWillUpdate == "function" && a.componentWillUpdate(r, p, c), typeof a.UNSAFE_componentWillUpdate == "function" && a.UNSAFE_componentWillUpdate(r, p, c)), typeof a.componentDidUpdate == "function" && (t.flags |= 4), typeof a.getSnapshotBeforeUpdate == "function" && (t.flags |= 1024)) : (typeof a.componentDidUpdate != "function" || o === e.memoizedProps && f === e.memoizedState || (t.flags |= 4), typeof a.getSnapshotBeforeUpdate != "function" || o === e.memoizedProps && f === e.memoizedState || (t.flags |= 1024), t.memoizedProps = r, t.memoizedState = p), a.props = r, a.state = p, a.context = c, r = u) : (typeof a.componentDidUpdate != "function" || o === e.memoizedProps && f === e.memoizedState || (t.flags |= 4), typeof a.getSnapshotBeforeUpdate != "function" || o === e.memoizedProps && f === e.memoizedState || (t.flags |= 1024), r = !1);
		}
		return a = r, mc(e, t), r = (t.flags & 128) != 0, a || r ? (a = t.stateNode, n = r && typeof n.getDerivedStateFromError != "function" ? null : a.render(), t.flags |= 1, e !== null && r ? (t.child = Ia(t, e.child, null, i), t.child = Ia(t, null, n, i)) : ic(e, t, n, i), t.memoizedState = a.state, e = t.child) : e = kc(e, t, i), e;
	}
	function vc(e, t, n, r) {
		return Bi(), t.flags |= 256, ic(e, t, n, r), t.child;
	}
	var yc = {
		dehydrated: null,
		treeContext: null,
		retryLane: 0,
		hydrationErrors: null
	};
	function bc(e) {
		return {
			baseLanes: e,
			cachePool: ya()
		};
	}
	function xc(e, t, n) {
		return e = e === null ? 0 : e.childLanes & ~n, t && (e |= Jl), e;
	}
	function Sc(e, t, n) {
		var r = t.pendingProps, a = !1, o = (t.flags & 128) != 0, s;
		if ((s = o) || (s = e !== null && e.memoizedState === null ? !1 : (co.current & 2) != 0), s && (a = !0, t.flags &= -129), s = (t.flags & 32) != 0, t.flags &= -33, e === null) {
			if (V) {
				if (a ? ro(t) : oo(t), (e = B) ? (e = rf(e, Pi), e = e !== null && e.data !== "&" ? e : null, e !== null && (t.memoizedState = {
					dehydrated: e,
					treeContext: wi === null ? null : {
						id: Ti,
						overflow: Ei
					},
					retryLane: 536870912,
					hydrationErrors: null
				}, n = mi(e), n.return = t, t.child = n, Mi = t, B = null)) : e = null, e === null) throw Ii(t);
				return of(e) ? t.lanes = 32 : t.lanes = 536870912, null;
			}
			var c = r.children;
			return r = r.fallback, a ? (oo(t), a = t.mode, c = wc({
				mode: "hidden",
				children: c
			}, a), r = fi(r, a, n, null), c.return = t, r.return = t, c.sibling = r, t.child = c, r = t.child, r.memoizedState = bc(n), r.childLanes = xc(e, s, n), t.memoizedState = yc, lc(null, r)) : (ro(t), Cc(t, c));
		}
		var l = e.memoizedState;
		if (l !== null && (c = l.dehydrated, c !== null)) {
			if (o) t.flags & 256 ? (ro(t), t.flags &= -257, t = Tc(e, t, n)) : t.memoizedState === null ? (oo(t), c = r.fallback, a = t.mode, r = wc({
				mode: "visible",
				children: r.children
			}, a), c = fi(c, a, n, null), c.flags |= 2, r.return = t, c.return = t, r.sibling = c, t.child = r, Ia(t, e.child, null, n), r = t.child, r.memoizedState = bc(n), r.childLanes = xc(e, s, n), t.memoizedState = yc, t = lc(null, r)) : (oo(t), t.child = e.child, t.flags |= 128, t = null);
			else if (ro(t), of(c)) {
				if (s = c.nextSibling && c.nextSibling.dataset, s) var u = s.dgst;
				s = u, r = Error(i(419)), r.stack = "", r.digest = s, Hi({
					value: r,
					source: null,
					stack: null
				}), t = Tc(e, t, n);
			} else if (rc || Xi(e, t, n, !1), s = (n & e.childLanes) !== 0, rc || s) {
				if (s = q, s !== null && (r = $e(s, n), r !== 0 && r !== l.retryLane)) throw l.retryLane = r, ni(e, r), hu(s, e, r), nc;
				af(c) || Du(), t = Tc(e, t, n);
			} else af(c) ? (t.flags |= 192, t.child = e.child, t = null) : (e = l.treeContext, B = cf(c.nextSibling), Mi = t, V = !0, Ni = null, Pi = !1, e !== null && ji(t, e), t = Cc(t, r.children), t.flags |= 4096);
			return t;
		}
		return a ? (oo(t), c = r.fallback, a = t.mode, l = e.child, u = l.sibling, r = li(l, {
			mode: "hidden",
			children: r.children
		}), r.subtreeFlags = l.subtreeFlags & 65011712, u === null ? (c = fi(c, a, n, null), c.flags |= 2) : c = li(u, c), c.return = t, r.return = t, r.sibling = c, t.child = r, lc(null, r), r = t.child, c = e.child.memoizedState, c === null ? c = bc(n) : (a = c.cachePool, a === null ? a = ya() : (l = aa._currentValue, a = a.parent === l ? a : {
			parent: l,
			pool: l
		}), c = {
			baseLanes: c.baseLanes | n,
			cachePool: a
		}), r.memoizedState = c, r.childLanes = xc(e, s, n), t.memoizedState = yc, lc(e.child, r)) : (ro(t), n = e.child, e = n.sibling, n = li(n, {
			mode: "visible",
			children: r.children
		}), n.return = t, n.sibling = null, e !== null && (s = t.deletions, s === null ? (t.deletions = [e], t.flags |= 16) : s.push(e)), t.child = n, t.memoizedState = null, n);
	}
	function Cc(e, t) {
		return t = wc({
			mode: "visible",
			children: t
		}, e.mode), t.return = e, e.child = t;
	}
	function wc(e, t) {
		return e = si(22, e, null, t), e.lanes = 0, e;
	}
	function Tc(e, t, n) {
		return Ia(t, e.child, null, n), e = Cc(t, t.pendingProps.children), e.flags |= 2, t.memoizedState = null, e;
	}
	function Ec(e, t, n) {
		e.lanes |= t;
		var r = e.alternate;
		r !== null && (r.lanes |= t), Ji(e.return, t, n);
	}
	function Dc(e, t, n, r, i, a) {
		var o = e.memoizedState;
		o === null ? e.memoizedState = {
			isBackwards: t,
			rendering: null,
			renderingStartTime: 0,
			last: r,
			tail: n,
			tailMode: i,
			treeForkCount: a
		} : (o.isBackwards = t, o.rendering = null, o.renderingStartTime = 0, o.last = r, o.tail = n, o.tailMode = i, o.treeForkCount = a);
	}
	function Oc(e, t, n) {
		var r = t.pendingProps, i = r.revealOrder, a = r.tail;
		r = r.children;
		var o = co.current, s = (o & 2) != 0;
		if (s ? (o = o & 1 | 2, t.flags |= 128) : o &= 1, R(co, o), ic(e, t, r, n), r = V ? xi : 0, !s && e !== null && e.flags & 128) a: for (e = t.child; e !== null;) {
			if (e.tag === 13) e.memoizedState !== null && Ec(e, n, t);
			else if (e.tag === 19) Ec(e, n, t);
			else if (e.child !== null) {
				e.child.return = e, e = e.child;
				continue;
			}
			if (e === t) break a;
			for (; e.sibling === null;) {
				if (e.return === null || e.return === t) break a;
				e = e.return;
			}
			e.sibling.return = e.return, e = e.sibling;
		}
		switch (i) {
			case "forwards":
				for (n = t.child, i = null; n !== null;) e = n.alternate, e !== null && lo(e) === null && (i = n), n = n.sibling;
				n = i, n === null ? (i = t.child, t.child = null) : (i = n.sibling, n.sibling = null), Dc(t, !1, i, n, a, r);
				break;
			case "backwards":
			case "unstable_legacy-backwards":
				for (n = null, i = t.child, t.child = null; i !== null;) {
					if (e = i.alternate, e !== null && lo(e) === null) {
						t.child = i;
						break;
					}
					e = i.sibling, i.sibling = n, n = i, i = e;
				}
				Dc(t, !0, n, null, a, r);
				break;
			case "together":
				Dc(t, !1, null, null, void 0, r);
				break;
			default: t.memoizedState = null;
		}
		return t.child;
	}
	function kc(e, t, n) {
		if (e !== null && (t.dependencies = e.dependencies), Gl |= t.lanes, (n & t.childLanes) === 0) if (e !== null) {
			if (Xi(e, t, n, !1), (n & t.childLanes) === 0) return null;
		} else return null;
		if (e !== null && t.child !== e.child) throw Error(i(153));
		if (t.child !== null) {
			for (e = t.child, n = li(e, e.pendingProps), t.child = n, n.return = t; e.sibling !== null;) e = e.sibling, n = n.sibling = li(e, e.pendingProps), n.return = t;
			n.sibling = null;
		}
		return t.child;
	}
	function Ac(e, t) {
		return (e.lanes & t) === 0 ? (e = e.dependencies, !!(e !== null && Zi(e))) : !0;
	}
	function jc(e, t, n) {
		switch (t.tag) {
			case 3:
				ce(t, t.stateNode.containerInfo), Ki(t, aa, e.memoizedState.cache), Bi();
				break;
			case 27:
			case 5:
				ue(t);
				break;
			case 4:
				ce(t, t.stateNode.containerInfo);
				break;
			case 10:
				Ki(t, t.type, t.memoizedProps.value);
				break;
			case 31:
				if (t.memoizedState !== null) return t.flags |= 128, io(t), null;
				break;
			case 13:
				var r = t.memoizedState;
				if (r !== null) return r.dehydrated === null ? (n & t.child.childLanes) === 0 ? (ro(t), e = kc(e, t, n), e === null ? null : e.sibling) : Sc(e, t, n) : (ro(t), t.flags |= 128, null);
				ro(t);
				break;
			case 19:
				var i = (e.flags & 128) != 0;
				if (r = (n & t.childLanes) !== 0, r ||= (Xi(e, t, n, !1), (n & t.childLanes) !== 0), i) {
					if (r) return Oc(e, t, n);
					t.flags |= 128;
				}
				if (i = t.memoizedState, i !== null && (i.rendering = null, i.tail = null, i.lastEffect = null), R(co, co.current), r) break;
				return null;
			case 22: return t.lanes = 0, cc(e, t, n, t.pendingProps);
			case 24: Ki(t, aa, e.memoizedState.cache);
		}
		return kc(e, t, n);
	}
	function Mc(e, t, n) {
		if (e !== null) if (e.memoizedProps !== t.pendingProps) rc = !0;
		else {
			if (!Ac(e, n) && !(t.flags & 128)) return rc = !1, jc(e, t, n);
			rc = !!(e.flags & 131072);
		}
		else rc = !1, V && t.flags & 1048576 && Oi(t, xi, t.index);
		switch (t.lanes = 0, t.tag) {
			case 16:
				a: {
					var r = t.pendingProps;
					if (e = Ea(t.elementType), t.type = e, typeof e == "function") ci(e) ? (r = Ks(e, r), t.tag = 1, t = _c(null, t, e, r, n)) : (t.tag = 0, t = hc(null, t, e, r, n));
					else {
						if (e != null) {
							var a = e.$$typeof;
							if (a === w) {
								t.tag = 11, t = ac(null, t, e, r, n);
								break a;
							} else if (a === ee) {
								t.tag = 14, t = oc(null, t, e, r, n);
								break a;
							}
						}
						throw t = M(e) || e, Error(i(306, t, ""));
					}
				}
				return t;
			case 0: return hc(e, t, t.type, t.pendingProps, n);
			case 1: return r = t.type, a = Ks(r, t.pendingProps), _c(e, t, r, a, n);
			case 3:
				a: {
					if (ce(t, t.stateNode.containerInfo), e === null) throw Error(i(387));
					r = t.pendingProps;
					var o = t.memoizedState;
					a = o.element, Ba(e, t), qa(t, r, null, n);
					var s = t.memoizedState;
					if (r = s.cache, Ki(t, aa, r), r !== o.cache && Yi(t, [aa], n, !0), Ka(), r = s.element, o.isDehydrated) if (o = {
						element: r,
						isDehydrated: !1,
						cache: s.cache
					}, t.updateQueue.baseState = o, t.memoizedState = o, t.flags & 256) {
						t = vc(e, t, r, n);
						break a;
					} else if (r !== a) {
						a = _i(Error(i(424)), t), Hi(a), t = vc(e, t, r, n);
						break a;
					} else {
						switch (e = t.stateNode.containerInfo, e.nodeType) {
							case 9:
								e = e.body;
								break;
							default: e = e.nodeName === "HTML" ? e.ownerDocument.body : e;
						}
						for (B = cf(e.firstChild), Mi = t, V = !0, Ni = null, Pi = !0, n = La(t, null, r, n), t.child = n; n;) n.flags = n.flags & -3 | 4096, n = n.sibling;
					}
					else {
						if (Bi(), r === a) {
							t = kc(e, t, n);
							break a;
						}
						ic(e, t, r, n);
					}
					t = t.child;
				}
				return t;
			case 26: return mc(e, t), e === null ? (n = kf(t.type, null, t.pendingProps, null)) ? t.memoizedState = n : V || (n = t.type, e = t.pendingProps, r = Bd(z.current).createElement(n), r[at] = t, r[ot] = e, Pd(r, n, e), vt(r), t.stateNode = r) : t.memoizedState = kf(t.type, e.memoizedProps, t.pendingProps, e.memoizedState), null;
			case 27: return ue(t), e === null && V && (r = t.stateNode = ff(t.type, t.pendingProps, z.current), Mi = t, Pi = !0, a = B, Zd(t.type) ? (lf = a, B = cf(r.firstChild)) : B = a), ic(e, t, t.pendingProps.children, n), mc(e, t), e === null && (t.flags |= 4194304), t.child;
			case 5: return e === null && V && ((a = r = B) && (r = tf(r, t.type, t.pendingProps, Pi), r === null ? a = !1 : (t.stateNode = r, Mi = t, B = cf(r.firstChild), Pi = !1, a = !0)), a || Ii(t)), ue(t), a = t.type, o = t.pendingProps, s = e === null ? null : e.memoizedProps, r = o.children, Ud(a, o) ? r = null : s !== null && Ud(a, s) && (t.flags |= 32), t.memoizedState !== null && (a = So(e, t, To, null, null, n), Qf._currentValue = a), mc(e, t), ic(e, t, r, n), t.child;
			case 6: return e === null && V && ((e = n = B) && (n = nf(n, t.pendingProps, Pi), n === null ? e = !1 : (t.stateNode = n, Mi = t, B = null, e = !0)), e || Ii(t)), null;
			case 13: return Sc(e, t, n);
			case 4: return ce(t, t.stateNode.containerInfo), r = t.pendingProps, e === null ? t.child = Ia(t, null, r, n) : ic(e, t, r, n), t.child;
			case 11: return ac(e, t, t.type, t.pendingProps, n);
			case 7: return ic(e, t, t.pendingProps, n), t.child;
			case 8: return ic(e, t, t.pendingProps.children, n), t.child;
			case 12: return ic(e, t, t.pendingProps.children, n), t.child;
			case 10: return r = t.pendingProps, Ki(t, t.type, r.value), ic(e, t, r.children, n), t.child;
			case 9: return a = t.type._context, r = t.pendingProps.children, Qi(t), a = $i(a), r = r(a), t.flags |= 1, ic(e, t, r, n), t.child;
			case 14: return oc(e, t, t.type, t.pendingProps, n);
			case 15: return sc(e, t, t.type, t.pendingProps, n);
			case 19: return Oc(e, t, n);
			case 31: return pc(e, t, n);
			case 22: return cc(e, t, n, t.pendingProps);
			case 24: return Qi(t), r = $i(aa), e === null ? (a = _a(), a === null && (a = q, o = oa(), a.pooledCache = o, o.refCount++, o !== null && (a.pooledCacheLanes |= n), a = o), t.memoizedState = {
				parent: r,
				cache: a
			}, za(t), Ki(t, aa, a)) : ((e.lanes & n) !== 0 && (Ba(e, t), qa(t, null, null, n), Ka()), a = e.memoizedState, o = t.memoizedState, a.parent === r ? (r = o.cache, Ki(t, aa, r), r !== a.cache && Yi(t, [aa], n, !0)) : (a = {
				parent: r,
				cache: r
			}, t.memoizedState = a, t.lanes === 0 && (t.memoizedState = t.updateQueue.baseState = a), Ki(t, aa, r))), ic(e, t, t.pendingProps.children, n), t.child;
			case 29: throw t.pendingProps;
		}
		throw Error(i(156, t.tag));
	}
	function Nc(e) {
		e.flags |= 4;
	}
	function Pc(e, t, n, r, i) {
		if ((t = (e.mode & 32) != 0) && (t = !1), t) {
			if (e.flags |= 16777216, (i & 335544128) === i) if (e.stateNode.complete) e.flags |= 8192;
			else if (wu()) e.flags |= 8192;
			else throw Da = Ca, xa;
		} else e.flags &= -16777217;
	}
	function Fc(e, t) {
		if (t.type !== "stylesheet" || t.state.loading & 4) e.flags &= -16777217;
		else if (e.flags |= 16777216, !Wf(t)) if (wu()) e.flags |= 8192;
		else throw Da = Ca, xa;
	}
	function Ic(e, t) {
		t !== null && (e.flags |= 4), e.flags & 16384 && (t = e.tag === 22 ? 536870912 : qe(), e.lanes |= t, Yl |= t);
	}
	function Lc(e, t) {
		if (!V) switch (e.tailMode) {
			case "hidden":
				t = e.tail;
				for (var n = null; t !== null;) t.alternate !== null && (n = t), t = t.sibling;
				n === null ? e.tail = null : n.sibling = null;
				break;
			case "collapsed":
				n = e.tail;
				for (var r = null; n !== null;) n.alternate !== null && (r = n), n = n.sibling;
				r === null ? t || e.tail === null ? e.tail = null : e.tail.sibling = null : r.sibling = null;
		}
	}
	function W(e) {
		var t = e.alternate !== null && e.alternate.child === e.child, n = 0, r = 0;
		if (t) for (var i = e.child; i !== null;) n |= i.lanes | i.childLanes, r |= i.subtreeFlags & 65011712, r |= i.flags & 65011712, i.return = e, i = i.sibling;
		else for (i = e.child; i !== null;) n |= i.lanes | i.childLanes, r |= i.subtreeFlags, r |= i.flags, i.return = e, i = i.sibling;
		return e.subtreeFlags |= r, e.childLanes = n, t;
	}
	function Rc(e, t, n) {
		var r = t.pendingProps;
		switch (Ai(t), t.tag) {
			case 16:
			case 15:
			case 0:
			case 11:
			case 7:
			case 8:
			case 12:
			case 9:
			case 14: return W(t), null;
			case 1: return W(t), null;
			case 3: return n = t.stateNode, r = null, e !== null && (r = e.memoizedState.cache), t.memoizedState.cache !== r && (t.flags |= 2048), qi(aa), le(), n.pendingContext && (n.context = n.pendingContext, n.pendingContext = null), (e === null || e.child === null) && (zi(t) ? Nc(t) : e === null || e.memoizedState.isDehydrated && !(t.flags & 256) || (t.flags |= 1024, Vi())), W(t), null;
			case 26:
				var a = t.type, o = t.memoizedState;
				return e === null ? (Nc(t), o === null ? (W(t), Pc(t, a, null, r, n)) : (W(t), Fc(t, o))) : o ? o === e.memoizedState ? (W(t), t.flags &= -16777217) : (Nc(t), W(t), Fc(t, o)) : (e = e.memoizedProps, e !== r && Nc(t), W(t), Pc(t, a, e, r, n)), null;
			case 27:
				if (de(t), n = z.current, a = t.type, e !== null && t.stateNode != null) e.memoizedProps !== r && Nc(t);
				else {
					if (!r) {
						if (t.stateNode === null) throw Error(i(166));
						return W(t), null;
					}
					e = ae.current, zi(t) ? Li(t, e) : (e = ff(a, r, n), t.stateNode = e, Nc(t));
				}
				return W(t), null;
			case 5:
				if (de(t), a = t.type, e !== null && t.stateNode != null) e.memoizedProps !== r && Nc(t);
				else {
					if (!r) {
						if (t.stateNode === null) throw Error(i(166));
						return W(t), null;
					}
					if (o = ae.current, zi(t)) Li(t, o);
					else {
						var s = Bd(z.current);
						switch (o) {
							case 1:
								o = s.createElementNS("http://www.w3.org/2000/svg", a);
								break;
							case 2:
								o = s.createElementNS("http://www.w3.org/1998/Math/MathML", a);
								break;
							default: switch (a) {
								case "svg":
									o = s.createElementNS("http://www.w3.org/2000/svg", a);
									break;
								case "math":
									o = s.createElementNS("http://www.w3.org/1998/Math/MathML", a);
									break;
								case "script":
									o = s.createElement("div"), o.innerHTML = "<script><\/script>", o = o.removeChild(o.firstChild);
									break;
								case "select":
									o = typeof r.is == "string" ? s.createElement("select", { is: r.is }) : s.createElement("select"), r.multiple ? o.multiple = !0 : r.size && (o.size = r.size);
									break;
								default: o = typeof r.is == "string" ? s.createElement(a, { is: r.is }) : s.createElement(a);
							}
						}
						o[at] = t, o[ot] = r;
						a: for (s = t.child; s !== null;) {
							if (s.tag === 5 || s.tag === 6) o.appendChild(s.stateNode);
							else if (s.tag !== 4 && s.tag !== 27 && s.child !== null) {
								s.child.return = s, s = s.child;
								continue;
							}
							if (s === t) break a;
							for (; s.sibling === null;) {
								if (s.return === null || s.return === t) break a;
								s = s.return;
							}
							s.sibling.return = s.return, s = s.sibling;
						}
						t.stateNode = o;
						a: switch (Pd(o, a, r), a) {
							case "button":
							case "input":
							case "select":
							case "textarea":
								r = !!r.autoFocus;
								break a;
							case "img":
								r = !0;
								break a;
							default: r = !1;
						}
						r && Nc(t);
					}
				}
				return W(t), Pc(t, t.type, e === null ? null : e.memoizedProps, t.pendingProps, n), null;
			case 6:
				if (e && t.stateNode != null) e.memoizedProps !== r && Nc(t);
				else {
					if (typeof r != "string" && t.stateNode === null) throw Error(i(166));
					if (e = z.current, zi(t)) {
						if (e = t.stateNode, n = t.memoizedProps, r = null, a = Mi, a !== null) switch (a.tag) {
							case 27:
							case 5: r = a.memoizedProps;
						}
						e[at] = t, e = !!(e.nodeValue === n || r !== null && !0 === r.suppressHydrationWarning || Md(e.nodeValue, n)), e || Ii(t, !0);
					} else e = Bd(e).createTextNode(r), e[at] = t, t.stateNode = e;
				}
				return W(t), null;
			case 31:
				if (n = t.memoizedState, e === null || e.memoizedState !== null) {
					if (r = zi(t), n !== null) {
						if (e === null) {
							if (!r) throw Error(i(318));
							if (e = t.memoizedState, e = e === null ? null : e.dehydrated, !e) throw Error(i(557));
							e[at] = t;
						} else Bi(), !(t.flags & 128) && (t.memoizedState = null), t.flags |= 4;
						W(t), e = !1;
					} else n = Vi(), e !== null && e.memoizedState !== null && (e.memoizedState.hydrationErrors = n), e = !0;
					if (!e) return t.flags & 256 ? (so(t), t) : (so(t), null);
					if (t.flags & 128) throw Error(i(558));
				}
				return W(t), null;
			case 13:
				if (r = t.memoizedState, e === null || e.memoizedState !== null && e.memoizedState.dehydrated !== null) {
					if (a = zi(t), r !== null && r.dehydrated !== null) {
						if (e === null) {
							if (!a) throw Error(i(318));
							if (a = t.memoizedState, a = a === null ? null : a.dehydrated, !a) throw Error(i(317));
							a[at] = t;
						} else Bi(), !(t.flags & 128) && (t.memoizedState = null), t.flags |= 4;
						W(t), a = !1;
					} else a = Vi(), e !== null && e.memoizedState !== null && (e.memoizedState.hydrationErrors = a), a = !0;
					if (!a) return t.flags & 256 ? (so(t), t) : (so(t), null);
				}
				return so(t), t.flags & 128 ? (t.lanes = n, t) : (n = r !== null, e = e !== null && e.memoizedState !== null, n && (r = t.child, a = null, r.alternate !== null && r.alternate.memoizedState !== null && r.alternate.memoizedState.cachePool !== null && (a = r.alternate.memoizedState.cachePool.pool), o = null, r.memoizedState !== null && r.memoizedState.cachePool !== null && (o = r.memoizedState.cachePool.pool), o !== a && (r.flags |= 2048)), n !== e && n && (t.child.flags |= 8192), Ic(t, t.updateQueue), W(t), null);
			case 4: return le(), e === null && Sd(t.stateNode.containerInfo), W(t), null;
			case 10: return qi(t.type), W(t), null;
			case 19:
				if (L(co), r = t.memoizedState, r === null) return W(t), null;
				if (a = (t.flags & 128) != 0, o = r.rendering, o === null) if (a) Lc(r, !1);
				else {
					if (Wl !== 0 || e !== null && e.flags & 128) for (e = t.child; e !== null;) {
						if (o = lo(e), o !== null) {
							for (t.flags |= 128, Lc(r, !1), e = o.updateQueue, t.updateQueue = e, Ic(t, e), t.subtreeFlags = 0, e = n, n = t.child; n !== null;) ui(n, e), n = n.sibling;
							return R(co, co.current & 1 | 2), V && Di(t, r.treeForkCount), t.child;
						}
						e = e.sibling;
					}
					r.tail !== null && we() > tu && (t.flags |= 128, a = !0, Lc(r, !1), t.lanes = 4194304);
				}
				else {
					if (!a) if (e = lo(o), e !== null) {
						if (t.flags |= 128, a = !0, e = e.updateQueue, t.updateQueue = e, Ic(t, e), Lc(r, !0), r.tail === null && r.tailMode === "hidden" && !o.alternate && !V) return W(t), null;
					} else 2 * we() - r.renderingStartTime > tu && n !== 536870912 && (t.flags |= 128, a = !0, Lc(r, !1), t.lanes = 4194304);
					r.isBackwards ? (o.sibling = t.child, t.child = o) : (e = r.last, e === null ? t.child = o : e.sibling = o, r.last = o);
				}
				return r.tail === null ? (W(t), null) : (e = r.tail, r.rendering = e, r.tail = e.sibling, r.renderingStartTime = we(), e.sibling = null, n = co.current, R(co, a ? n & 1 | 2 : n & 1), V && Di(t, r.treeForkCount), e);
			case 22:
			case 23: return so(t), eo(), r = t.memoizedState !== null, e === null ? r && (t.flags |= 8192) : e.memoizedState !== null !== r && (t.flags |= 8192), r ? n & 536870912 && !(t.flags & 128) && (W(t), t.subtreeFlags & 6 && (t.flags |= 8192)) : W(t), n = t.updateQueue, n !== null && Ic(t, n.retryQueue), n = null, e !== null && e.memoizedState !== null && e.memoizedState.cachePool !== null && (n = e.memoizedState.cachePool.pool), r = null, t.memoizedState !== null && t.memoizedState.cachePool !== null && (r = t.memoizedState.cachePool.pool), r !== n && (t.flags |= 2048), e !== null && L(ga), null;
			case 24: return n = null, e !== null && (n = e.memoizedState.cache), t.memoizedState.cache !== n && (t.flags |= 2048), qi(aa), W(t), null;
			case 25: return null;
			case 30: return null;
		}
		throw Error(i(156, t.tag));
	}
	function zc(e, t) {
		switch (Ai(t), t.tag) {
			case 1: return e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
			case 3: return qi(aa), le(), e = t.flags, e & 65536 && !(e & 128) ? (t.flags = e & -65537 | 128, t) : null;
			case 26:
			case 27:
			case 5: return de(t), null;
			case 31:
				if (t.memoizedState !== null) {
					if (so(t), t.alternate === null) throw Error(i(340));
					Bi();
				}
				return e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
			case 13:
				if (so(t), e = t.memoizedState, e !== null && e.dehydrated !== null) {
					if (t.alternate === null) throw Error(i(340));
					Bi();
				}
				return e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
			case 19: return L(co), null;
			case 4: return le(), null;
			case 10: return qi(t.type), null;
			case 22:
			case 23: return so(t), eo(), e !== null && L(ga), e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
			case 24: return qi(aa), null;
			case 25: return null;
			default: return null;
		}
	}
	function Bc(e, t) {
		switch (Ai(t), t.tag) {
			case 3:
				qi(aa), le();
				break;
			case 26:
			case 27:
			case 5:
				de(t);
				break;
			case 4:
				le();
				break;
			case 31:
				t.memoizedState !== null && so(t);
				break;
			case 13:
				so(t);
				break;
			case 19:
				L(co);
				break;
			case 10:
				qi(t.type);
				break;
			case 22:
			case 23:
				so(t), eo(), e !== null && L(ga);
				break;
			case 24: qi(aa);
		}
	}
	function Vc(e, t) {
		try {
			var n = t.updateQueue, r = n === null ? null : n.lastEffect;
			if (r !== null) {
				var i = r.next;
				n = i;
				do {
					if ((n.tag & e) === e) {
						r = void 0;
						var a = n.create, o = n.inst;
						r = a(), o.destroy = r;
					}
					n = n.next;
				} while (n !== i);
			}
		} catch (e) {
			Z(t, t.return, e);
		}
	}
	function Hc(e, t, n) {
		try {
			var r = t.updateQueue, i = r === null ? null : r.lastEffect;
			if (i !== null) {
				var a = i.next;
				r = a;
				do {
					if ((r.tag & e) === e) {
						var o = r.inst, s = o.destroy;
						if (s !== void 0) {
							o.destroy = void 0, i = t;
							var c = n, l = s;
							try {
								l();
							} catch (e) {
								Z(i, c, e);
							}
						}
					}
					r = r.next;
				} while (r !== a);
			}
		} catch (e) {
			Z(t, t.return, e);
		}
	}
	function Uc(e) {
		var t = e.updateQueue;
		if (t !== null) {
			var n = e.stateNode;
			try {
				Ya(t, n);
			} catch (t) {
				Z(e, e.return, t);
			}
		}
	}
	function Wc(e, t, n) {
		n.props = Ks(e.type, e.memoizedProps), n.state = e.memoizedState;
		try {
			n.componentWillUnmount();
		} catch (n) {
			Z(e, t, n);
		}
	}
	function Gc(e, t) {
		try {
			var n = e.ref;
			if (n !== null) {
				switch (e.tag) {
					case 26:
					case 27:
					case 5:
						var r = e.stateNode;
						break;
					case 30:
						r = e.stateNode;
						break;
					default: r = e.stateNode;
				}
				typeof n == "function" ? e.refCleanup = n(r) : n.current = r;
			}
		} catch (n) {
			Z(e, t, n);
		}
	}
	function Kc(e, t) {
		var n = e.ref, r = e.refCleanup;
		if (n !== null) if (typeof r == "function") try {
			r();
		} catch (n) {
			Z(e, t, n);
		} finally {
			e.refCleanup = null, e = e.alternate, e != null && (e.refCleanup = null);
		}
		else if (typeof n == "function") try {
			n(null);
		} catch (n) {
			Z(e, t, n);
		}
		else n.current = null;
	}
	function qc(e) {
		var t = e.type, n = e.memoizedProps, r = e.stateNode;
		try {
			a: switch (t) {
				case "button":
				case "input":
				case "select":
				case "textarea":
					n.autoFocus && r.focus();
					break a;
				case "img": n.src ? r.src = n.src : n.srcSet && (r.srcset = n.srcSet);
			}
		} catch (t) {
			Z(e, e.return, t);
		}
	}
	function Jc(e, t, n) {
		try {
			var r = e.stateNode;
			Fd(r, e.type, n, t), r[ot] = t;
		} catch (t) {
			Z(e, e.return, t);
		}
	}
	function Yc(e) {
		return e.tag === 5 || e.tag === 3 || e.tag === 26 || e.tag === 27 && Zd(e.type) || e.tag === 4;
	}
	function Xc(e) {
		a: for (;;) {
			for (; e.sibling === null;) {
				if (e.return === null || Yc(e.return)) return null;
				e = e.return;
			}
			for (e.sibling.return = e.return, e = e.sibling; e.tag !== 5 && e.tag !== 6 && e.tag !== 18;) {
				if (e.tag === 27 && Zd(e.type) || e.flags & 2 || e.child === null || e.tag === 4) continue a;
				e.child.return = e, e = e.child;
			}
			if (!(e.flags & 2)) return e.stateNode;
		}
	}
	function Zc(e, t, n) {
		var r = e.tag;
		if (r === 5 || r === 6) e = e.stateNode, t ? (n.nodeType === 9 ? n.body : n.nodeName === "HTML" ? n.ownerDocument.body : n).insertBefore(e, t) : (t = n.nodeType === 9 ? n.body : n.nodeName === "HTML" ? n.ownerDocument.body : n, t.appendChild(e), n = n._reactRootContainer, n != null || t.onclick !== null || (t.onclick = Qt));
		else if (r !== 4 && (r === 27 && Zd(e.type) && (n = e.stateNode, t = null), e = e.child, e !== null)) for (Zc(e, t, n), e = e.sibling; e !== null;) Zc(e, t, n), e = e.sibling;
	}
	function Qc(e, t, n) {
		var r = e.tag;
		if (r === 5 || r === 6) e = e.stateNode, t ? n.insertBefore(e, t) : n.appendChild(e);
		else if (r !== 4 && (r === 27 && Zd(e.type) && (n = e.stateNode), e = e.child, e !== null)) for (Qc(e, t, n), e = e.sibling; e !== null;) Qc(e, t, n), e = e.sibling;
	}
	function $c(e) {
		var t = e.stateNode, n = e.memoizedProps;
		try {
			for (var r = e.type, i = t.attributes; i.length;) t.removeAttributeNode(i[0]);
			Pd(t, r, n), t[at] = e, t[ot] = n;
		} catch (t) {
			Z(e, e.return, t);
		}
	}
	var el = !1, tl = !1, nl = !1, rl = typeof WeakSet == "function" ? WeakSet : Set, il = null;
	function al(e, t) {
		if (e = e.containerInfo, Rd = sp, e = Er(e), Dr(e)) {
			if ("selectionStart" in e) var n = {
				start: e.selectionStart,
				end: e.selectionEnd
			};
			else a: {
				n = (n = e.ownerDocument) && n.defaultView || window;
				var r = n.getSelection && n.getSelection();
				if (r && r.rangeCount !== 0) {
					n = r.anchorNode;
					var a = r.anchorOffset, o = r.focusNode;
					r = r.focusOffset;
					try {
						n.nodeType, o.nodeType;
					} catch {
						n = null;
						break a;
					}
					var s = 0, c = -1, l = -1, u = 0, d = 0, f = e, p = null;
					b: for (;;) {
						for (var m; f !== n || a !== 0 && f.nodeType !== 3 || (c = s + a), f !== o || r !== 0 && f.nodeType !== 3 || (l = s + r), f.nodeType === 3 && (s += f.nodeValue.length), (m = f.firstChild) !== null;) p = f, f = m;
						for (;;) {
							if (f === e) break b;
							if (p === n && ++u === a && (c = s), p === o && ++d === r && (l = s), (m = f.nextSibling) !== null) break;
							f = p, p = f.parentNode;
						}
						f = m;
					}
					n = c === -1 || l === -1 ? null : {
						start: c,
						end: l
					};
				} else n = null;
			}
			n ||= {
				start: 0,
				end: 0
			};
		} else n = null;
		for (zd = {
			focusedElem: e,
			selectionRange: n
		}, sp = !1, il = t; il !== null;) if (t = il, e = t.child, t.subtreeFlags & 1028 && e !== null) e.return = t, il = e;
		else for (; il !== null;) {
			switch (t = il, o = t.alternate, e = t.flags, t.tag) {
				case 0:
					if (e & 4 && (e = t.updateQueue, e = e === null ? null : e.events, e !== null)) for (n = 0; n < e.length; n++) a = e[n], a.ref.impl = a.nextImpl;
					break;
				case 11:
				case 15: break;
				case 1:
					if (e & 1024 && o !== null) {
						e = void 0, n = t, a = o.memoizedProps, o = o.memoizedState, r = n.stateNode;
						try {
							var h = Ks(n.type, a);
							e = r.getSnapshotBeforeUpdate(h, o), r.__reactInternalSnapshotBeforeUpdate = e;
						} catch (e) {
							Z(n, n.return, e);
						}
					}
					break;
				case 3:
					if (e & 1024) {
						if (e = t.stateNode.containerInfo, n = e.nodeType, n === 9) ef(e);
						else if (n === 1) switch (e.nodeName) {
							case "HEAD":
							case "HTML":
							case "BODY":
								ef(e);
								break;
							default: e.textContent = "";
						}
					}
					break;
				case 5:
				case 26:
				case 27:
				case 6:
				case 4:
				case 17: break;
				default: if (e & 1024) throw Error(i(163));
			}
			if (e = t.sibling, e !== null) {
				e.return = t.return, il = e;
				break;
			}
			il = t.return;
		}
	}
	function ol(e, t, n) {
		var r = n.flags;
		switch (n.tag) {
			case 0:
			case 11:
			case 15:
				bl(e, n), r & 4 && Vc(5, n);
				break;
			case 1:
				if (bl(e, n), r & 4) if (e = n.stateNode, t === null) try {
					e.componentDidMount();
				} catch (e) {
					Z(n, n.return, e);
				}
				else {
					var i = Ks(n.type, t.memoizedProps);
					t = t.memoizedState;
					try {
						e.componentDidUpdate(i, t, e.__reactInternalSnapshotBeforeUpdate);
					} catch (e) {
						Z(n, n.return, e);
					}
				}
				r & 64 && Uc(n), r & 512 && Gc(n, n.return);
				break;
			case 3:
				if (bl(e, n), r & 64 && (e = n.updateQueue, e !== null)) {
					if (t = null, n.child !== null) switch (n.child.tag) {
						case 27:
						case 5:
							t = n.child.stateNode;
							break;
						case 1: t = n.child.stateNode;
					}
					try {
						Ya(e, t);
					} catch (e) {
						Z(n, n.return, e);
					}
				}
				break;
			case 27: t === null && r & 4 && $c(n);
			case 26:
			case 5:
				bl(e, n), t === null && r & 4 && qc(n), r & 512 && Gc(n, n.return);
				break;
			case 12:
				bl(e, n);
				break;
			case 31:
				bl(e, n), r & 4 && dl(e, n);
				break;
			case 13:
				bl(e, n), r & 4 && fl(e, n), r & 64 && (e = n.memoizedState, e !== null && (e = e.dehydrated, e !== null && (n = Ju.bind(null, n), sf(e, n))));
				break;
			case 22:
				if (r = n.memoizedState !== null || el, !r) {
					t = t !== null && t.memoizedState !== null || tl, i = el;
					var a = tl;
					el = r, (tl = t) && !a ? Sl(e, n, (n.subtreeFlags & 8772) != 0) : bl(e, n), el = i, tl = a;
				}
				break;
			case 30: break;
			default: bl(e, n);
		}
	}
	function sl(e) {
		var t = e.alternate;
		t !== null && (e.alternate = null, sl(t)), e.child = null, e.deletions = null, e.sibling = null, e.tag === 5 && (t = e.stateNode, t !== null && pt(t)), e.stateNode = null, e.return = null, e.dependencies = null, e.memoizedProps = null, e.memoizedState = null, e.pendingProps = null, e.stateNode = null, e.updateQueue = null;
	}
	var G = null, cl = !1;
	function ll(e, t, n) {
		for (n = n.child; n !== null;) ul(e, t, n), n = n.sibling;
	}
	function ul(e, t, n) {
		if (Pe && typeof Pe.onCommitFiberUnmount == "function") try {
			Pe.onCommitFiberUnmount(Ne, n);
		} catch {}
		switch (n.tag) {
			case 26:
				tl || Kc(n, t), ll(e, t, n), n.memoizedState ? n.memoizedState.count-- : n.stateNode && (n = n.stateNode, n.parentNode.removeChild(n));
				break;
			case 27:
				tl || Kc(n, t);
				var r = G, i = cl;
				Zd(n.type) && (G = n.stateNode, cl = !1), ll(e, t, n), pf(n.stateNode), G = r, cl = i;
				break;
			case 5: tl || Kc(n, t);
			case 6:
				if (r = G, i = cl, G = null, ll(e, t, n), G = r, cl = i, G !== null) if (cl) try {
					(G.nodeType === 9 ? G.body : G.nodeName === "HTML" ? G.ownerDocument.body : G).removeChild(n.stateNode);
				} catch (e) {
					Z(n, t, e);
				}
				else try {
					G.removeChild(n.stateNode);
				} catch (e) {
					Z(n, t, e);
				}
				break;
			case 18:
				G !== null && (cl ? (e = G, Qd(e.nodeType === 9 ? e.body : e.nodeName === "HTML" ? e.ownerDocument.body : e, n.stateNode), Np(e)) : Qd(G, n.stateNode));
				break;
			case 4:
				r = G, i = cl, G = n.stateNode.containerInfo, cl = !0, ll(e, t, n), G = r, cl = i;
				break;
			case 0:
			case 11:
			case 14:
			case 15:
				Hc(2, n, t), tl || Hc(4, n, t), ll(e, t, n);
				break;
			case 1:
				tl || (Kc(n, t), r = n.stateNode, typeof r.componentWillUnmount == "function" && Wc(n, t, r)), ll(e, t, n);
				break;
			case 21:
				ll(e, t, n);
				break;
			case 22:
				tl = (r = tl) || n.memoizedState !== null, ll(e, t, n), tl = r;
				break;
			default: ll(e, t, n);
		}
	}
	function dl(e, t) {
		if (t.memoizedState === null && (e = t.alternate, e !== null && (e = e.memoizedState, e !== null))) {
			e = e.dehydrated;
			try {
				Np(e);
			} catch (e) {
				Z(t, t.return, e);
			}
		}
	}
	function fl(e, t) {
		if (t.memoizedState === null && (e = t.alternate, e !== null && (e = e.memoizedState, e !== null && (e = e.dehydrated, e !== null)))) try {
			Np(e);
		} catch (e) {
			Z(t, t.return, e);
		}
	}
	function pl(e) {
		switch (e.tag) {
			case 31:
			case 13:
			case 19:
				var t = e.stateNode;
				return t === null && (t = e.stateNode = new rl()), t;
			case 22: return e = e.stateNode, t = e._retryCache, t === null && (t = e._retryCache = new rl()), t;
			default: throw Error(i(435, e.tag));
		}
	}
	function ml(e, t) {
		var n = pl(e);
		t.forEach(function(t) {
			if (!n.has(t)) {
				n.add(t);
				var r = Yu.bind(null, e, t);
				t.then(r, r);
			}
		});
	}
	function hl(e, t) {
		var n = t.deletions;
		if (n !== null) for (var r = 0; r < n.length; r++) {
			var a = n[r], o = e, s = t, c = s;
			a: for (; c !== null;) {
				switch (c.tag) {
					case 27:
						if (Zd(c.type)) {
							G = c.stateNode, cl = !1;
							break a;
						}
						break;
					case 5:
						G = c.stateNode, cl = !1;
						break a;
					case 3:
					case 4:
						G = c.stateNode.containerInfo, cl = !0;
						break a;
				}
				c = c.return;
			}
			if (G === null) throw Error(i(160));
			ul(o, s, a), G = null, cl = !1, o = a.alternate, o !== null && (o.return = null), a.return = null;
		}
		if (t.subtreeFlags & 13886) for (t = t.child; t !== null;) _l(t, e), t = t.sibling;
	}
	var gl = null;
	function _l(e, t) {
		var n = e.alternate, r = e.flags;
		switch (e.tag) {
			case 0:
			case 11:
			case 14:
			case 15:
				hl(t, e), vl(e), r & 4 && (Hc(3, e, e.return), Vc(3, e), Hc(5, e, e.return));
				break;
			case 1:
				hl(t, e), vl(e), r & 512 && (tl || n === null || Kc(n, n.return)), r & 64 && el && (e = e.updateQueue, e !== null && (r = e.callbacks, r !== null && (n = e.shared.hiddenCallbacks, e.shared.hiddenCallbacks = n === null ? r : n.concat(r))));
				break;
			case 26:
				var a = gl;
				if (hl(t, e), vl(e), r & 512 && (tl || n === null || Kc(n, n.return)), r & 4) {
					var o = n === null ? null : n.memoizedState;
					if (r = e.memoizedState, n === null) if (r === null) if (e.stateNode === null) {
						a: {
							r = e.type, n = e.memoizedProps, a = a.ownerDocument || a;
							b: switch (r) {
								case "title":
									o = a.getElementsByTagName("title")[0], (!o || o[ft] || o[at] || o.namespaceURI === "http://www.w3.org/2000/svg" || o.hasAttribute("itemprop")) && (o = a.createElement(r), a.head.insertBefore(o, a.querySelector("head > title"))), Pd(o, r, n), o[at] = e, vt(o), r = o;
									break a;
								case "link":
									var s = Vf("link", "href", a).get(r + (n.href || ""));
									if (s) {
										for (var c = 0; c < s.length; c++) if (o = s[c], o.getAttribute("href") === (n.href == null || n.href === "" ? null : n.href) && o.getAttribute("rel") === (n.rel == null ? null : n.rel) && o.getAttribute("title") === (n.title == null ? null : n.title) && o.getAttribute("crossorigin") === (n.crossOrigin == null ? null : n.crossOrigin)) {
											s.splice(c, 1);
											break b;
										}
									}
									o = a.createElement(r), Pd(o, r, n), a.head.appendChild(o);
									break;
								case "meta":
									if (s = Vf("meta", "content", a).get(r + (n.content || ""))) {
										for (c = 0; c < s.length; c++) if (o = s[c], o.getAttribute("content") === (n.content == null ? null : "" + n.content) && o.getAttribute("name") === (n.name == null ? null : n.name) && o.getAttribute("property") === (n.property == null ? null : n.property) && o.getAttribute("http-equiv") === (n.httpEquiv == null ? null : n.httpEquiv) && o.getAttribute("charset") === (n.charSet == null ? null : n.charSet)) {
											s.splice(c, 1);
											break b;
										}
									}
									o = a.createElement(r), Pd(o, r, n), a.head.appendChild(o);
									break;
								default: throw Error(i(468, r));
							}
							o[at] = e, vt(o), r = o;
						}
						e.stateNode = r;
					} else Hf(a, e.type, e.stateNode);
					else e.stateNode = If(a, r, e.memoizedProps);
					else o === r ? r === null && e.stateNode !== null && Jc(e, e.memoizedProps, n.memoizedProps) : (o === null ? n.stateNode !== null && (n = n.stateNode, n.parentNode.removeChild(n)) : o.count--, r === null ? Hf(a, e.type, e.stateNode) : If(a, r, e.memoizedProps));
				}
				break;
			case 27:
				hl(t, e), vl(e), r & 512 && (tl || n === null || Kc(n, n.return)), n !== null && r & 4 && Jc(e, e.memoizedProps, n.memoizedProps);
				break;
			case 5:
				if (hl(t, e), vl(e), r & 512 && (tl || n === null || Kc(n, n.return)), e.flags & 32) {
					a = e.stateNode;
					try {
						Wt(a, "");
					} catch (t) {
						Z(e, e.return, t);
					}
				}
				r & 4 && e.stateNode != null && (a = e.memoizedProps, Jc(e, a, n === null ? a : n.memoizedProps)), r & 1024 && (nl = !0);
				break;
			case 6:
				if (hl(t, e), vl(e), r & 4) {
					if (e.stateNode === null) throw Error(i(162));
					r = e.memoizedProps, n = e.stateNode;
					try {
						n.nodeValue = r;
					} catch (t) {
						Z(e, e.return, t);
					}
				}
				break;
			case 3:
				if (Bf = null, a = gl, gl = gf(t.containerInfo), hl(t, e), gl = a, vl(e), r & 4 && n !== null && n.memoizedState.isDehydrated) try {
					Np(t.containerInfo);
				} catch (t) {
					Z(e, e.return, t);
				}
				nl && (nl = !1, yl(e));
				break;
			case 4:
				r = gl, gl = gf(e.stateNode.containerInfo), hl(t, e), vl(e), gl = r;
				break;
			case 12:
				hl(t, e), vl(e);
				break;
			case 31:
				hl(t, e), vl(e), r & 4 && (r = e.updateQueue, r !== null && (e.updateQueue = null, ml(e, r)));
				break;
			case 13:
				hl(t, e), vl(e), e.child.flags & 8192 && e.memoizedState !== null != (n !== null && n.memoizedState !== null) && ($l = we()), r & 4 && (r = e.updateQueue, r !== null && (e.updateQueue = null, ml(e, r)));
				break;
			case 22:
				a = e.memoizedState !== null;
				var l = n !== null && n.memoizedState !== null, u = el, d = tl;
				if (el = u || a, tl = d || l, hl(t, e), tl = d, el = u, vl(e), r & 8192) a: for (t = e.stateNode, t._visibility = a ? t._visibility & -2 : t._visibility | 1, a && (n === null || l || el || tl || xl(e)), n = null, t = e;;) {
					if (t.tag === 5 || t.tag === 26) {
						if (n === null) {
							l = n = t;
							try {
								if (o = l.stateNode, a) s = o.style, typeof s.setProperty == "function" ? s.setProperty("display", "none", "important") : s.display = "none";
								else {
									c = l.stateNode;
									var f = l.memoizedProps.style, p = f != null && f.hasOwnProperty("display") ? f.display : null;
									c.style.display = p == null || typeof p == "boolean" ? "" : ("" + p).trim();
								}
							} catch (e) {
								Z(l, l.return, e);
							}
						}
					} else if (t.tag === 6) {
						if (n === null) {
							l = t;
							try {
								l.stateNode.nodeValue = a ? "" : l.memoizedProps;
							} catch (e) {
								Z(l, l.return, e);
							}
						}
					} else if (t.tag === 18) {
						if (n === null) {
							l = t;
							try {
								var m = l.stateNode;
								a ? $d(m, !0) : $d(l.stateNode, !1);
							} catch (e) {
								Z(l, l.return, e);
							}
						}
					} else if ((t.tag !== 22 && t.tag !== 23 || t.memoizedState === null || t === e) && t.child !== null) {
						t.child.return = t, t = t.child;
						continue;
					}
					if (t === e) break a;
					for (; t.sibling === null;) {
						if (t.return === null || t.return === e) break a;
						n === t && (n = null), t = t.return;
					}
					n === t && (n = null), t.sibling.return = t.return, t = t.sibling;
				}
				r & 4 && (r = e.updateQueue, r !== null && (n = r.retryQueue, n !== null && (r.retryQueue = null, ml(e, n))));
				break;
			case 19:
				hl(t, e), vl(e), r & 4 && (r = e.updateQueue, r !== null && (e.updateQueue = null, ml(e, r)));
				break;
			case 30: break;
			case 21: break;
			default: hl(t, e), vl(e);
		}
	}
	function vl(e) {
		var t = e.flags;
		if (t & 2) {
			try {
				for (var n, r = e.return; r !== null;) {
					if (Yc(r)) {
						n = r;
						break;
					}
					r = r.return;
				}
				if (n == null) throw Error(i(160));
				switch (n.tag) {
					case 27:
						var a = n.stateNode;
						Qc(e, Xc(e), a);
						break;
					case 5:
						var o = n.stateNode;
						n.flags & 32 && (Wt(o, ""), n.flags &= -33), Qc(e, Xc(e), o);
						break;
					case 3:
					case 4:
						var s = n.stateNode.containerInfo;
						Zc(e, Xc(e), s);
						break;
					default: throw Error(i(161));
				}
			} catch (t) {
				Z(e, e.return, t);
			}
			e.flags &= -3;
		}
		t & 4096 && (e.flags &= -4097);
	}
	function yl(e) {
		if (e.subtreeFlags & 1024) for (e = e.child; e !== null;) {
			var t = e;
			yl(t), t.tag === 5 && t.flags & 1024 && t.stateNode.reset(), e = e.sibling;
		}
	}
	function bl(e, t) {
		if (t.subtreeFlags & 8772) for (t = t.child; t !== null;) ol(e, t.alternate, t), t = t.sibling;
	}
	function xl(e) {
		for (e = e.child; e !== null;) {
			var t = e;
			switch (t.tag) {
				case 0:
				case 11:
				case 14:
				case 15:
					Hc(4, t, t.return), xl(t);
					break;
				case 1:
					Kc(t, t.return);
					var n = t.stateNode;
					typeof n.componentWillUnmount == "function" && Wc(t, t.return, n), xl(t);
					break;
				case 27: pf(t.stateNode);
				case 26:
				case 5:
					Kc(t, t.return), xl(t);
					break;
				case 22:
					t.memoizedState === null && xl(t);
					break;
				case 30:
					xl(t);
					break;
				default: xl(t);
			}
			e = e.sibling;
		}
	}
	function Sl(e, t, n) {
		for (n &&= (t.subtreeFlags & 8772) != 0, t = t.child; t !== null;) {
			var r = t.alternate, i = e, a = t, o = a.flags;
			switch (a.tag) {
				case 0:
				case 11:
				case 15:
					Sl(i, a, n), Vc(4, a);
					break;
				case 1:
					if (Sl(i, a, n), r = a, i = r.stateNode, typeof i.componentDidMount == "function") try {
						i.componentDidMount();
					} catch (e) {
						Z(r, r.return, e);
					}
					if (r = a, i = r.updateQueue, i !== null) {
						var s = r.stateNode;
						try {
							var c = i.shared.hiddenCallbacks;
							if (c !== null) for (i.shared.hiddenCallbacks = null, i = 0; i < c.length; i++) Ja(c[i], s);
						} catch (e) {
							Z(r, r.return, e);
						}
					}
					n && o & 64 && Uc(a), Gc(a, a.return);
					break;
				case 27: $c(a);
				case 26:
				case 5:
					Sl(i, a, n), n && r === null && o & 4 && qc(a), Gc(a, a.return);
					break;
				case 12:
					Sl(i, a, n);
					break;
				case 31:
					Sl(i, a, n), n && o & 4 && dl(i, a);
					break;
				case 13:
					Sl(i, a, n), n && o & 4 && fl(i, a);
					break;
				case 22:
					a.memoizedState === null && Sl(i, a, n), Gc(a, a.return);
					break;
				case 30: break;
				default: Sl(i, a, n);
			}
			t = t.sibling;
		}
	}
	function Cl(e, t) {
		var n = null;
		e !== null && e.memoizedState !== null && e.memoizedState.cachePool !== null && (n = e.memoizedState.cachePool.pool), e = null, t.memoizedState !== null && t.memoizedState.cachePool !== null && (e = t.memoizedState.cachePool.pool), e !== n && (e != null && e.refCount++, n != null && sa(n));
	}
	function wl(e, t) {
		e = null, t.alternate !== null && (e = t.alternate.memoizedState.cache), t = t.memoizedState.cache, t !== e && (t.refCount++, e != null && sa(e));
	}
	function Tl(e, t, n, r) {
		if (t.subtreeFlags & 10256) for (t = t.child; t !== null;) El(e, t, n, r), t = t.sibling;
	}
	function El(e, t, n, r) {
		var i = t.flags;
		switch (t.tag) {
			case 0:
			case 11:
			case 15:
				Tl(e, t, n, r), i & 2048 && Vc(9, t);
				break;
			case 1:
				Tl(e, t, n, r);
				break;
			case 3:
				Tl(e, t, n, r), i & 2048 && (e = null, t.alternate !== null && (e = t.alternate.memoizedState.cache), t = t.memoizedState.cache, t !== e && (t.refCount++, e != null && sa(e)));
				break;
			case 12:
				if (i & 2048) {
					Tl(e, t, n, r), e = t.stateNode;
					try {
						var a = t.memoizedProps, o = a.id, s = a.onPostCommit;
						typeof s == "function" && s(o, t.alternate === null ? "mount" : "update", e.passiveEffectDuration, -0);
					} catch (e) {
						Z(t, t.return, e);
					}
				} else Tl(e, t, n, r);
				break;
			case 31:
				Tl(e, t, n, r);
				break;
			case 13:
				Tl(e, t, n, r);
				break;
			case 23: break;
			case 22:
				a = t.stateNode, o = t.alternate, t.memoizedState === null ? a._visibility & 2 ? Tl(e, t, n, r) : (a._visibility |= 2, Dl(e, t, n, r, (t.subtreeFlags & 10256) != 0 || !1)) : a._visibility & 2 ? Tl(e, t, n, r) : Ol(e, t), i & 2048 && Cl(o, t);
				break;
			case 24:
				Tl(e, t, n, r), i & 2048 && wl(t.alternate, t);
				break;
			default: Tl(e, t, n, r);
		}
	}
	function Dl(e, t, n, r, i) {
		for (i &&= (t.subtreeFlags & 10256) != 0 || !1, t = t.child; t !== null;) {
			var a = e, o = t, s = n, c = r, l = o.flags;
			switch (o.tag) {
				case 0:
				case 11:
				case 15:
					Dl(a, o, s, c, i), Vc(8, o);
					break;
				case 23: break;
				case 22:
					var u = o.stateNode;
					o.memoizedState === null ? (u._visibility |= 2, Dl(a, o, s, c, i)) : u._visibility & 2 ? Dl(a, o, s, c, i) : Ol(a, o), i && l & 2048 && Cl(o.alternate, o);
					break;
				case 24:
					Dl(a, o, s, c, i), i && l & 2048 && wl(o.alternate, o);
					break;
				default: Dl(a, o, s, c, i);
			}
			t = t.sibling;
		}
	}
	function Ol(e, t) {
		if (t.subtreeFlags & 10256) for (t = t.child; t !== null;) {
			var n = e, r = t, i = r.flags;
			switch (r.tag) {
				case 22:
					Ol(n, r), i & 2048 && Cl(r.alternate, r);
					break;
				case 24:
					Ol(n, r), i & 2048 && wl(r.alternate, r);
					break;
				default: Ol(n, r);
			}
			t = t.sibling;
		}
	}
	var kl = 8192;
	function Al(e, t, n) {
		if (e.subtreeFlags & kl) for (e = e.child; e !== null;) jl(e, t, n), e = e.sibling;
	}
	function jl(e, t, n) {
		switch (e.tag) {
			case 26:
				Al(e, t, n), e.flags & kl && e.memoizedState !== null && Gf(n, gl, e.memoizedState, e.memoizedProps);
				break;
			case 5:
				Al(e, t, n);
				break;
			case 3:
			case 4:
				var r = gl;
				gl = gf(e.stateNode.containerInfo), Al(e, t, n), gl = r;
				break;
			case 22:
				e.memoizedState === null && (r = e.alternate, r !== null && r.memoizedState !== null ? (r = kl, kl = 16777216, Al(e, t, n), kl = r) : Al(e, t, n));
				break;
			default: Al(e, t, n);
		}
	}
	function Ml(e) {
		var t = e.alternate;
		if (t !== null && (e = t.child, e !== null)) {
			t.child = null;
			do
				t = e.sibling, e.sibling = null, e = t;
			while (e !== null);
		}
	}
	function Nl(e) {
		var t = e.deletions;
		if (e.flags & 16) {
			if (t !== null) for (var n = 0; n < t.length; n++) {
				var r = t[n];
				il = r, Il(r, e);
			}
			Ml(e);
		}
		if (e.subtreeFlags & 10256) for (e = e.child; e !== null;) Pl(e), e = e.sibling;
	}
	function Pl(e) {
		switch (e.tag) {
			case 0:
			case 11:
			case 15:
				Nl(e), e.flags & 2048 && Hc(9, e, e.return);
				break;
			case 3:
				Nl(e);
				break;
			case 12:
				Nl(e);
				break;
			case 22:
				var t = e.stateNode;
				e.memoizedState !== null && t._visibility & 2 && (e.return === null || e.return.tag !== 13) ? (t._visibility &= -3, Fl(e)) : Nl(e);
				break;
			default: Nl(e);
		}
	}
	function Fl(e) {
		var t = e.deletions;
		if (e.flags & 16) {
			if (t !== null) for (var n = 0; n < t.length; n++) {
				var r = t[n];
				il = r, Il(r, e);
			}
			Ml(e);
		}
		for (e = e.child; e !== null;) {
			switch (t = e, t.tag) {
				case 0:
				case 11:
				case 15:
					Hc(8, t, t.return), Fl(t);
					break;
				case 22:
					n = t.stateNode, n._visibility & 2 && (n._visibility &= -3, Fl(t));
					break;
				default: Fl(t);
			}
			e = e.sibling;
		}
	}
	function Il(e, t) {
		for (; il !== null;) {
			var n = il;
			switch (n.tag) {
				case 0:
				case 11:
				case 15:
					Hc(8, n, t);
					break;
				case 23:
				case 22:
					if (n.memoizedState !== null && n.memoizedState.cachePool !== null) {
						var r = n.memoizedState.cachePool.pool;
						r != null && r.refCount++;
					}
					break;
				case 24: sa(n.memoizedState.cache);
			}
			if (r = n.child, r !== null) r.return = n, il = r;
			else a: for (n = e; il !== null;) {
				r = il;
				var i = r.sibling, a = r.return;
				if (sl(r), r === n) {
					il = null;
					break a;
				}
				if (i !== null) {
					i.return = a, il = i;
					break a;
				}
				il = a;
			}
		}
	}
	var Ll = {
		getCacheForType: function(e) {
			var t = $i(aa), n = t.data.get(e);
			return n === void 0 && (n = e(), t.data.set(e, n)), n;
		},
		cacheSignal: function() {
			return $i(aa).controller.signal;
		}
	}, Rl = typeof WeakMap == "function" ? WeakMap : Map, K = 0, q = null, J = null, Y = 0, X = 0, zl = null, Bl = !1, Vl = !1, Hl = !1, Ul = 0, Wl = 0, Gl = 0, Kl = 0, ql = 0, Jl = 0, Yl = 0, Xl = null, Zl = null, Ql = !1, $l = 0, eu = 0, tu = Infinity, nu = null, ru = null, iu = 0, au = null, ou = null, su = 0, cu = 0, lu = null, uu = null, du = 0, fu = null;
	function pu() {
		return K & 2 && Y !== 0 ? Y & -Y : P.T === null ? nt() : dd();
	}
	function mu() {
		if (Jl === 0) if (!(Y & 536870912) || V) {
			var e = Ve;
			Ve <<= 1, !(Ve & 3932160) && (Ve = 262144), Jl = e;
		} else Jl = 536870912;
		return e = to.current, e !== null && (e.flags |= 32), Jl;
	}
	function hu(e, t, n) {
		(e === q && (X === 2 || X === 9) || e.cancelPendingCommit !== null) && (Su(e, 0), yu(e, Y, Jl, !1)), Ye(e, n), (!(K & 2) || e !== q) && (e === q && (!(K & 2) && (Kl |= n), Wl === 4 && yu(e, Y, Jl, !1)), rd(e));
	}
	function gu(e, t, n) {
		if (K & 6) throw Error(i(327));
		var r = !n && (t & 127) == 0 && (t & e.expiredLanes) === 0 || Ge(e, t), a = r ? Au(e, t) : Ou(e, t, !0), o = r;
		do {
			if (a === 0) {
				Vl && !r && yu(e, t, 0, !1);
				break;
			} else {
				if (n = e.current.alternate, o && !vu(n)) {
					a = Ou(e, t, !1), o = !1;
					continue;
				}
				if (a === 2) {
					if (o = t, e.errorRecoveryDisabledLanes & o) var s = 0;
					else s = e.pendingLanes & -536870913, s = s === 0 ? s & 536870912 ? 536870912 : 0 : s;
					if (s !== 0) {
						t = s;
						a: {
							var c = e;
							a = Xl;
							var l = c.current.memoizedState.isDehydrated;
							if (l && (Su(c, s).flags |= 256), s = Ou(c, s, !1), s !== 2) {
								if (Hl && !l) {
									c.errorRecoveryDisabledLanes |= o, Kl |= o, a = 4;
									break a;
								}
								o = Zl, Zl = a, o !== null && (Zl === null ? Zl = o : Zl.push.apply(Zl, o));
							}
							a = s;
						}
						if (o = !1, a !== 2) continue;
					}
				}
				if (a === 1) {
					Su(e, 0), yu(e, t, 0, !0);
					break;
				}
				a: {
					switch (r = e, o = a, o) {
						case 0:
						case 1: throw Error(i(345));
						case 4: if ((t & 4194048) !== t) break;
						case 6:
							yu(r, t, Jl, !Bl);
							break a;
						case 2:
							Zl = null;
							break;
						case 3:
						case 5: break;
						default: throw Error(i(329));
					}
					if ((t & 62914560) === t && (a = $l + 300 - we(), 10 < a)) {
						if (yu(r, t, Jl, !Bl), We(r, 0, !0) !== 0) break a;
						su = t, r.timeoutHandle = Kd(_u.bind(null, r, n, Zl, nu, Ql, t, Jl, Kl, Yl, Bl, o, "Throttled", -0, 0), a);
						break a;
					}
					_u(r, n, Zl, nu, Ql, t, Jl, Kl, Yl, Bl, o, null, -0, 0);
				}
			}
			break;
		} while (1);
		rd(e);
	}
	function _u(e, t, n, r, i, a, o, s, c, l, u, d, f, p) {
		if (e.timeoutHandle = -1, d = t.subtreeFlags, d & 8192 || (d & 16785408) == 16785408) {
			d = {
				stylesheets: null,
				count: 0,
				imgCount: 0,
				imgBytes: 0,
				suspenseyImages: [],
				waitingForImages: !0,
				waitingForViewTransition: !1,
				unsuspend: Qt
			}, jl(t, a, d);
			var m = (a & 62914560) === a ? $l - we() : (a & 4194048) === a ? eu - we() : 0;
			if (m = qf(d, m), m !== null) {
				su = a, e.cancelPendingCommit = m(Lu.bind(null, e, t, a, n, r, i, o, s, c, u, d, null, f, p)), yu(e, a, o, !l);
				return;
			}
		}
		Lu(e, t, a, n, r, i, o, s, c);
	}
	function vu(e) {
		for (var t = e;;) {
			var n = t.tag;
			if ((n === 0 || n === 11 || n === 15) && t.flags & 16384 && (n = t.updateQueue, n !== null && (n = n.stores, n !== null))) for (var r = 0; r < n.length; r++) {
				var i = n[r], a = i.getSnapshot;
				i = i.value;
				try {
					if (!xr(a(), i)) return !1;
				} catch {
					return !1;
				}
			}
			if (n = t.child, t.subtreeFlags & 16384 && n !== null) n.return = t, t = n;
			else {
				if (t === e) break;
				for (; t.sibling === null;) {
					if (t.return === null || t.return === e) return !0;
					t = t.return;
				}
				t.sibling.return = t.return, t = t.sibling;
			}
		}
		return !0;
	}
	function yu(e, t, n, r) {
		t &= ~ql, t &= ~Kl, e.suspendedLanes |= t, e.pingedLanes &= ~t, r && (e.warmLanes |= t), r = e.expirationTimes;
		for (var i = t; 0 < i;) {
			var a = 31 - Ie(i), o = 1 << a;
			r[a] = -1, i &= ~o;
		}
		n !== 0 && Ze(e, n, t);
	}
	function bu() {
		return K & 6 ? !0 : (id(0, !1), !1);
	}
	function xu() {
		if (J !== null) {
			if (X === 0) var e = J.return;
			else e = J, Gi = Wi = null, Oo(e), Aa = null, ja = 0, e = J;
			for (; e !== null;) Bc(e.alternate, e), e = e.return;
			J = null;
		}
	}
	function Su(e, t) {
		var n = e.timeoutHandle;
		n !== -1 && (e.timeoutHandle = -1, qd(n)), n = e.cancelPendingCommit, n !== null && (e.cancelPendingCommit = null, n()), su = 0, xu(), q = e, J = n = li(e.current, null), Y = t, X = 0, zl = null, Bl = !1, Vl = Ge(e, t), Hl = !1, Yl = Jl = ql = Kl = Gl = Wl = 0, Zl = Xl = null, Ql = !1, t & 8 && (t |= t & 32);
		var r = e.entangledLanes;
		if (r !== 0) for (e = e.entanglements, r &= t; 0 < r;) {
			var i = 31 - Ie(r), a = 1 << i;
			t |= e[i], r &= ~a;
		}
		return Ul = t, $r(), n;
	}
	function Cu(e, t) {
		H = null, P.H = Rs, t === ba || t === Sa ? (t = Oa(), X = 3) : t === xa ? (t = Oa(), X = 4) : X = t === nc ? 8 : typeof t == "object" && t && typeof t.then == "function" ? 6 : 1, zl = t, J === null && (Wl = 1, Xs(e, _i(t, e.current)));
	}
	function wu() {
		var e = to.current;
		return e === null ? !0 : (Y & 4194048) === Y ? no === null : (Y & 62914560) === Y || Y & 536870912 ? e === no : !1;
	}
	function Tu() {
		var e = P.H;
		return P.H = Rs, e === null ? Rs : e;
	}
	function Eu() {
		var e = P.A;
		return P.A = Ll, e;
	}
	function Du() {
		Wl = 4, Bl || (Y & 4194048) !== Y && to.current !== null || (Vl = !0), !(Gl & 134217727) && !(Kl & 134217727) || q === null || yu(q, Y, Jl, !1);
	}
	function Ou(e, t, n) {
		var r = K;
		K |= 2;
		var i = Tu(), a = Eu();
		(q !== e || Y !== t) && (nu = null, Su(e, t)), t = !1;
		var o = Wl;
		a: do
			try {
				if (X !== 0 && J !== null) {
					var s = J, c = zl;
					switch (X) {
						case 8:
							xu(), o = 6;
							break a;
						case 3:
						case 2:
						case 9:
						case 6:
							to.current === null && (t = !0);
							var l = X;
							if (X = 0, zl = null, Pu(e, s, c, l), n && Vl) {
								o = 0;
								break a;
							}
							break;
						default: l = X, X = 0, zl = null, Pu(e, s, c, l);
					}
				}
				ku(), o = Wl;
				break;
			} catch (t) {
				Cu(e, t);
			}
		while (1);
		return t && e.shellSuspendCounter++, Gi = Wi = null, K = r, P.H = i, P.A = a, J === null && (q = null, Y = 0, $r()), o;
	}
	function ku() {
		for (; J !== null;) Mu(J);
	}
	function Au(e, t) {
		var n = K;
		K |= 2;
		var r = Tu(), a = Eu();
		q !== e || Y !== t ? (nu = null, tu = we() + 500, Su(e, t)) : Vl = Ge(e, t);
		a: do
			try {
				if (X !== 0 && J !== null) {
					t = J;
					var o = zl;
					b: switch (X) {
						case 1:
							X = 0, zl = null, Pu(e, t, o, 1);
							break;
						case 2:
						case 9:
							if (wa(o)) {
								X = 0, zl = null, Nu(t);
								break;
							}
							t = function() {
								X !== 2 && X !== 9 || q !== e || (X = 7), rd(e);
							}, o.then(t, t);
							break a;
						case 3:
							X = 7;
							break a;
						case 4:
							X = 5;
							break a;
						case 7:
							wa(o) ? (X = 0, zl = null, Nu(t)) : (X = 0, zl = null, Pu(e, t, o, 7));
							break;
						case 5:
							var s = null;
							switch (J.tag) {
								case 26: s = J.memoizedState;
								case 5:
								case 27:
									var c = J;
									if (s ? Wf(s) : c.stateNode.complete) {
										X = 0, zl = null;
										var l = c.sibling;
										if (l !== null) J = l;
										else {
											var u = c.return;
											u === null ? J = null : (J = u, Fu(u));
										}
										break b;
									}
							}
							X = 0, zl = null, Pu(e, t, o, 5);
							break;
						case 6:
							X = 0, zl = null, Pu(e, t, o, 6);
							break;
						case 8:
							xu(), Wl = 6;
							break a;
						default: throw Error(i(462));
					}
				}
				ju();
				break;
			} catch (t) {
				Cu(e, t);
			}
		while (1);
		return Gi = Wi = null, P.H = r, P.A = a, K = n, J === null ? (q = null, Y = 0, $r(), Wl) : 0;
	}
	function ju() {
		for (; J !== null && !Se();) Mu(J);
	}
	function Mu(e) {
		var t = Mc(e.alternate, e, Ul);
		e.memoizedProps = e.pendingProps, t === null ? Fu(e) : J = t;
	}
	function Nu(e) {
		var t = e, n = t.alternate;
		switch (t.tag) {
			case 15:
			case 0:
				t = gc(n, t, t.pendingProps, t.type, void 0, Y);
				break;
			case 11:
				t = gc(n, t, t.pendingProps, t.type.render, t.ref, Y);
				break;
			case 5: Oo(t);
			default: Bc(n, t), t = J = ui(t, Ul), t = Mc(n, t, Ul);
		}
		e.memoizedProps = e.pendingProps, t === null ? Fu(e) : J = t;
	}
	function Pu(e, t, n, r) {
		Gi = Wi = null, Oo(t), Aa = null, ja = 0;
		var i = t.return;
		try {
			if (tc(e, i, t, n, Y)) {
				Wl = 1, Xs(e, _i(n, e.current)), J = null;
				return;
			}
		} catch (t) {
			if (i !== null) throw J = i, t;
			Wl = 1, Xs(e, _i(n, e.current)), J = null;
			return;
		}
		t.flags & 32768 ? (V || r === 1 ? e = !0 : Vl || Y & 536870912 ? e = !1 : (Bl = e = !0, (r === 2 || r === 9 || r === 3 || r === 6) && (r = to.current, r !== null && r.tag === 13 && (r.flags |= 16384))), Iu(t, e)) : Fu(t);
	}
	function Fu(e) {
		var t = e;
		do {
			if (t.flags & 32768) {
				Iu(t, Bl);
				return;
			}
			e = t.return;
			var n = Rc(t.alternate, t, Ul);
			if (n !== null) {
				J = n;
				return;
			}
			if (t = t.sibling, t !== null) {
				J = t;
				return;
			}
			J = t = e;
		} while (t !== null);
		Wl === 0 && (Wl = 5);
	}
	function Iu(e, t) {
		do {
			var n = zc(e.alternate, e);
			if (n !== null) {
				n.flags &= 32767, J = n;
				return;
			}
			if (n = e.return, n !== null && (n.flags |= 32768, n.subtreeFlags = 0, n.deletions = null), !t && (e = e.sibling, e !== null)) {
				J = e;
				return;
			}
			J = e = n;
		} while (e !== null);
		Wl = 6, J = null;
	}
	function Lu(e, t, n, r, a, o, s, c, l) {
		e.cancelPendingCommit = null;
		do
			Hu();
		while (iu !== 0);
		if (K & 6) throw Error(i(327));
		if (t !== null) {
			if (t === e.current) throw Error(i(177));
			if (o = t.lanes | t.childLanes, o |= Qr, Xe(e, n, o, s, c, l), e === q && (J = q = null, Y = 0), ou = t, au = e, su = n, cu = o, lu = a, uu = r, t.subtreeFlags & 10256 || t.flags & 10256 ? (e.callbackNode = null, e.callbackPriority = 0, Xu(Oe, function() {
				return Uu(), null;
			})) : (e.callbackNode = null, e.callbackPriority = 0), r = (t.flags & 13878) != 0, t.subtreeFlags & 13878 || r) {
				r = P.T, P.T = null, a = F.p, F.p = 2, s = K, K |= 4;
				try {
					al(e, t, n);
				} finally {
					K = s, F.p = a, P.T = r;
				}
			}
			iu = 1, Ru(), zu(), Bu();
		}
	}
	function Ru() {
		if (iu === 1) {
			iu = 0;
			var e = au, t = ou, n = (t.flags & 13878) != 0;
			if (t.subtreeFlags & 13878 || n) {
				n = P.T, P.T = null;
				var r = F.p;
				F.p = 2;
				var i = K;
				K |= 4;
				try {
					_l(t, e);
					var a = zd, o = Er(e.containerInfo), s = a.focusedElem, c = a.selectionRange;
					if (o !== s && s && s.ownerDocument && Tr(s.ownerDocument.documentElement, s)) {
						if (c !== null && Dr(s)) {
							var l = c.start, u = c.end;
							if (u === void 0 && (u = l), "selectionStart" in s) s.selectionStart = l, s.selectionEnd = Math.min(u, s.value.length);
							else {
								var d = s.ownerDocument || document, f = d && d.defaultView || window;
								if (f.getSelection) {
									var p = f.getSelection(), m = s.textContent.length, h = Math.min(c.start, m), g = c.end === void 0 ? h : Math.min(c.end, m);
									!p.extend && h > g && (o = g, g = h, h = o);
									var _ = wr(s, h), v = wr(s, g);
									if (_ && v && (p.rangeCount !== 1 || p.anchorNode !== _.node || p.anchorOffset !== _.offset || p.focusNode !== v.node || p.focusOffset !== v.offset)) {
										var y = d.createRange();
										y.setStart(_.node, _.offset), p.removeAllRanges(), h > g ? (p.addRange(y), p.extend(v.node, v.offset)) : (y.setEnd(v.node, v.offset), p.addRange(y));
									}
								}
							}
						}
						for (d = [], p = s; p = p.parentNode;) p.nodeType === 1 && d.push({
							element: p,
							left: p.scrollLeft,
							top: p.scrollTop
						});
						for (typeof s.focus == "function" && s.focus(), s = 0; s < d.length; s++) {
							var b = d[s];
							b.element.scrollLeft = b.left, b.element.scrollTop = b.top;
						}
					}
					sp = !!Rd, zd = Rd = null;
				} finally {
					K = i, F.p = r, P.T = n;
				}
			}
			e.current = t, iu = 2;
		}
	}
	function zu() {
		if (iu === 2) {
			iu = 0;
			var e = au, t = ou, n = (t.flags & 8772) != 0;
			if (t.subtreeFlags & 8772 || n) {
				n = P.T, P.T = null;
				var r = F.p;
				F.p = 2;
				var i = K;
				K |= 4;
				try {
					ol(e, t.alternate, t);
				} finally {
					K = i, F.p = r, P.T = n;
				}
			}
			iu = 3;
		}
	}
	function Bu() {
		if (iu === 4 || iu === 3) {
			iu = 0, Ce();
			var e = au, t = ou, n = su, r = uu;
			t.subtreeFlags & 10256 || t.flags & 10256 ? iu = 5 : (iu = 0, ou = au = null, Vu(e, e.pendingLanes));
			var i = e.pendingLanes;
			if (i === 0 && (ru = null), tt(n), t = t.stateNode, Pe && typeof Pe.onCommitFiberRoot == "function") try {
				Pe.onCommitFiberRoot(Ne, t, void 0, (t.current.flags & 128) == 128);
			} catch {}
			if (r !== null) {
				t = P.T, i = F.p, F.p = 2, P.T = null;
				try {
					for (var a = e.onRecoverableError, o = 0; o < r.length; o++) {
						var s = r[o];
						a(s.value, { componentStack: s.stack });
					}
				} finally {
					P.T = t, F.p = i;
				}
			}
			su & 3 && Hu(), rd(e), i = e.pendingLanes, n & 261930 && i & 42 ? e === fu ? du++ : (du = 0, fu = e) : du = 0, id(0, !1);
		}
	}
	function Vu(e, t) {
		(e.pooledCacheLanes &= t) === 0 && (t = e.pooledCache, t != null && (e.pooledCache = null, sa(t)));
	}
	function Hu() {
		return Ru(), zu(), Bu(), Uu();
	}
	function Uu() {
		if (iu !== 5) return !1;
		var e = au, t = cu;
		cu = 0;
		var n = tt(su), r = P.T, a = F.p;
		try {
			F.p = 32 > n ? 32 : n, P.T = null, n = lu, lu = null;
			var o = au, s = su;
			if (iu = 0, ou = au = null, su = 0, K & 6) throw Error(i(331));
			var c = K;
			if (K |= 4, Pl(o.current), El(o, o.current, s, n), K = c, id(0, !1), Pe && typeof Pe.onPostCommitFiberRoot == "function") try {
				Pe.onPostCommitFiberRoot(Ne, o);
			} catch {}
			return !0;
		} finally {
			F.p = a, P.T = r, Vu(e, t);
		}
	}
	function Wu(e, t, n) {
		t = _i(n, t), t = Qs(e.stateNode, t, 2), e = Ha(e, t, 2), e !== null && (Ye(e, 2), rd(e));
	}
	function Z(e, t, n) {
		if (e.tag === 3) Wu(e, e, n);
		else for (; t !== null;) {
			if (t.tag === 3) {
				Wu(t, e, n);
				break;
			} else if (t.tag === 1) {
				var r = t.stateNode;
				if (typeof t.type.getDerivedStateFromError == "function" || typeof r.componentDidCatch == "function" && (ru === null || !ru.has(r))) {
					e = _i(n, e), n = $s(2), r = Ha(t, n, 2), r !== null && (ec(n, r, t, e), Ye(r, 2), rd(r));
					break;
				}
			}
			t = t.return;
		}
	}
	function Gu(e, t, n) {
		var r = e.pingCache;
		if (r === null) {
			r = e.pingCache = new Rl();
			var i = /* @__PURE__ */ new Set();
			r.set(t, i);
		} else i = r.get(t), i === void 0 && (i = /* @__PURE__ */ new Set(), r.set(t, i));
		i.has(n) || (Hl = !0, i.add(n), e = Ku.bind(null, e, t, n), t.then(e, e));
	}
	function Ku(e, t, n) {
		var r = e.pingCache;
		r !== null && r.delete(t), e.pingedLanes |= e.suspendedLanes & n, e.warmLanes &= ~n, q === e && (Y & n) === n && (Wl === 4 || Wl === 3 && (Y & 62914560) === Y && 300 > we() - $l ? !(K & 2) && Su(e, 0) : ql |= n, Yl === Y && (Yl = 0)), rd(e);
	}
	function qu(e, t) {
		t === 0 && (t = qe()), e = ni(e, t), e !== null && (Ye(e, t), rd(e));
	}
	function Ju(e) {
		var t = e.memoizedState, n = 0;
		t !== null && (n = t.retryLane), qu(e, n);
	}
	function Yu(e, t) {
		var n = 0;
		switch (e.tag) {
			case 31:
			case 13:
				var r = e.stateNode, a = e.memoizedState;
				a !== null && (n = a.retryLane);
				break;
			case 19:
				r = e.stateNode;
				break;
			case 22:
				r = e.stateNode._retryCache;
				break;
			default: throw Error(i(314));
		}
		r !== null && r.delete(t), qu(e, n);
	}
	function Xu(e, t) {
		return be(e, t);
	}
	var Zu = null, Qu = null, $u = !1, ed = !1, td = !1, nd = 0;
	function rd(e) {
		e !== Qu && e.next === null && (Qu === null ? Zu = Qu = e : Qu = Qu.next = e), ed = !0, $u || ($u = !0, ud());
	}
	function id(e, t) {
		if (!td && ed) {
			td = !0;
			do
				for (var n = !1, r = Zu; r !== null;) {
					if (!t) if (e !== 0) {
						var i = r.pendingLanes;
						if (i === 0) var a = 0;
						else {
							var o = r.suspendedLanes, s = r.pingedLanes;
							a = (1 << 31 - Ie(42 | e) + 1) - 1, a &= i & ~(o & ~s), a = a & 201326741 ? a & 201326741 | 1 : a ? a | 2 : 0;
						}
						a !== 0 && (n = !0, ld(r, a));
					} else a = Y, a = We(r, r === q ? a : 0, r.cancelPendingCommit !== null || r.timeoutHandle !== -1), !(a & 3) || Ge(r, a) || (n = !0, ld(r, a));
					r = r.next;
				}
			while (n);
			td = !1;
		}
	}
	function ad() {
		od();
	}
	function od() {
		ed = $u = !1;
		var e = 0;
		nd !== 0 && Gd() && (e = nd);
		for (var t = we(), n = null, r = Zu; r !== null;) {
			var i = r.next, a = sd(r, t);
			a === 0 ? (r.next = null, n === null ? Zu = i : n.next = i, i === null && (Qu = n)) : (n = r, (e !== 0 || a & 3) && (ed = !0)), r = i;
		}
		iu !== 0 && iu !== 5 || id(e, !1), nd !== 0 && (nd = 0);
	}
	function sd(e, t) {
		for (var n = e.suspendedLanes, r = e.pingedLanes, i = e.expirationTimes, a = e.pendingLanes & -62914561; 0 < a;) {
			var o = 31 - Ie(a), s = 1 << o, c = i[o];
			c === -1 ? ((s & n) === 0 || (s & r) !== 0) && (i[o] = Ke(s, t)) : c <= t && (e.expiredLanes |= s), a &= ~s;
		}
		if (t = q, n = Y, n = We(e, e === t ? n : 0, e.cancelPendingCommit !== null || e.timeoutHandle !== -1), r = e.callbackNode, n === 0 || e === t && (X === 2 || X === 9) || e.cancelPendingCommit !== null) return r !== null && r !== null && xe(r), e.callbackNode = null, e.callbackPriority = 0;
		if (!(n & 3) || Ge(e, n)) {
			if (t = n & -n, t === e.callbackPriority) return t;
			switch (r !== null && xe(r), tt(n)) {
				case 2:
				case 8:
					n = De;
					break;
				case 32:
					n = Oe;
					break;
				case 268435456:
					n = Ae;
					break;
				default: n = Oe;
			}
			return r = cd.bind(null, e), n = be(n, r), e.callbackPriority = t, e.callbackNode = n, t;
		}
		return r !== null && r !== null && xe(r), e.callbackPriority = 2, e.callbackNode = null, 2;
	}
	function cd(e, t) {
		if (iu !== 0 && iu !== 5) return e.callbackNode = null, e.callbackPriority = 0, null;
		var n = e.callbackNode;
		if (Hu() && e.callbackNode !== n) return null;
		var r = Y;
		return r = We(e, e === q ? r : 0, e.cancelPendingCommit !== null || e.timeoutHandle !== -1), r === 0 ? null : (gu(e, r, t), sd(e, we()), e.callbackNode != null && e.callbackNode === n ? cd.bind(null, e) : null);
	}
	function ld(e, t) {
		if (Hu()) return null;
		gu(e, t, !0);
	}
	function ud() {
		Yd(function() {
			K & 6 ? be(Ee, ad) : od();
		});
	}
	function dd() {
		if (nd === 0) {
			var e = ua;
			e === 0 && (e = Be, Be <<= 1, !(Be & 261888) && (Be = 256)), nd = e;
		}
		return nd;
	}
	function fd(e) {
		return e == null || typeof e == "symbol" || typeof e == "boolean" ? null : typeof e == "function" ? e : Zt("" + e);
	}
	function pd(e, t) {
		var n = t.ownerDocument.createElement("input");
		return n.name = t.name, n.value = t.value, e.id && n.setAttribute("form", e.id), t.parentNode.insertBefore(n, t), e = new FormData(e), n.parentNode.removeChild(n), e;
	}
	function md(e, t, n, r, i) {
		if (t === "submit" && n && n.stateNode === i) {
			var a = fd((i[ot] || null).action), o = r.submitter;
			o && (t = (t = o[ot] || null) ? fd(t.formAction) : o.getAttribute("formAction"), t !== null && (a = t, o = null));
			var s = new bn("action", "action", null, r, i);
			e.push({
				event: s,
				listeners: [{
					instance: null,
					listener: function() {
						if (r.defaultPrevented) {
							if (nd !== 0) {
								var e = o ? pd(i, o) : new FormData(i);
								ws(n, {
									pending: !0,
									data: e,
									method: i.method,
									action: a
								}, null, e);
							}
						} else typeof a == "function" && (s.preventDefault(), e = o ? pd(i, o) : new FormData(i), ws(n, {
							pending: !0,
							data: e,
							method: i.method,
							action: a
						}, a, e));
					},
					currentTarget: i
				}]
			});
		}
	}
	for (var hd = 0; hd < qr.length; hd++) {
		var gd = qr[hd];
		Jr(gd.toLowerCase(), "on" + (gd[0].toUpperCase() + gd.slice(1)));
	}
	Jr(zr, "onAnimationEnd"), Jr(Br, "onAnimationIteration"), Jr(Vr, "onAnimationStart"), Jr("dblclick", "onDoubleClick"), Jr("focusin", "onFocus"), Jr("focusout", "onBlur"), Jr(Hr, "onTransitionRun"), Jr(Ur, "onTransitionStart"), Jr(Wr, "onTransitionCancel"), Jr(Gr, "onTransitionEnd"), St("onMouseEnter", ["mouseout", "mouseover"]), St("onMouseLeave", ["mouseout", "mouseover"]), St("onPointerEnter", ["pointerout", "pointerover"]), St("onPointerLeave", ["pointerout", "pointerover"]), xt("onChange", "change click focusin focusout input keydown keyup selectionchange".split(" ")), xt("onSelect", "focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(" ")), xt("onBeforeInput", [
		"compositionend",
		"keypress",
		"textInput",
		"paste"
	]), xt("onCompositionEnd", "compositionend focusout keydown keypress keyup mousedown".split(" ")), xt("onCompositionStart", "compositionstart focusout keydown keypress keyup mousedown".split(" ")), xt("onCompositionUpdate", "compositionupdate focusout keydown keypress keyup mousedown".split(" "));
	var _d = "abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(" "), vd = new Set("beforetoggle cancel close invalid load scroll scrollend toggle".split(" ").concat(_d));
	function yd(e, t) {
		t = (t & 4) != 0;
		for (var n = 0; n < e.length; n++) {
			var r = e[n], i = r.event;
			r = r.listeners;
			a: {
				var a = void 0;
				if (t) for (var o = r.length - 1; 0 <= o; o--) {
					var s = r[o], c = s.instance, l = s.currentTarget;
					if (s = s.listener, c !== a && i.isPropagationStopped()) break a;
					a = s, i.currentTarget = l;
					try {
						a(i);
					} catch (e) {
						Yr(e);
					}
					i.currentTarget = null, a = c;
				}
				else for (o = 0; o < r.length; o++) {
					if (s = r[o], c = s.instance, l = s.currentTarget, s = s.listener, c !== a && i.isPropagationStopped()) break a;
					a = s, i.currentTarget = l;
					try {
						a(i);
					} catch (e) {
						Yr(e);
					}
					i.currentTarget = null, a = c;
				}
			}
		}
	}
	function Q(e, t) {
		var n = t[ct];
		n === void 0 && (n = t[ct] = /* @__PURE__ */ new Set());
		var r = e + "__bubble";
		n.has(r) || (Cd(t, e, 2, !1), n.add(r));
	}
	function bd(e, t, n) {
		var r = 0;
		t && (r |= 4), Cd(n, e, r, t);
	}
	var xd = "_reactListening" + Math.random().toString(36).slice(2);
	function Sd(e) {
		if (!e[xd]) {
			e[xd] = !0, yt.forEach(function(t) {
				t !== "selectionchange" && (vd.has(t) || bd(t, !1, e), bd(t, !0, e));
			});
			var t = e.nodeType === 9 ? e : e.ownerDocument;
			t === null || t[xd] || (t[xd] = !0, bd("selectionchange", !1, t));
		}
	}
	function Cd(e, t, n, r) {
		switch (mp(t)) {
			case 2:
				var i = cp;
				break;
			case 8:
				i = lp;
				break;
			default: i = up;
		}
		n = i.bind(null, t, n, e), i = void 0, !ln || t !== "touchstart" && t !== "touchmove" && t !== "wheel" || (i = !0), r ? i === void 0 ? e.addEventListener(t, n, !0) : e.addEventListener(t, n, {
			capture: !0,
			passive: i
		}) : i === void 0 ? e.addEventListener(t, n, !1) : e.addEventListener(t, n, { passive: i });
	}
	function wd(e, t, n, r, i) {
		var a = r;
		if (!(t & 1) && !(t & 2) && r !== null) a: for (;;) {
			if (r === null) return;
			var s = r.tag;
			if (s === 3 || s === 4) {
				var c = r.stateNode.containerInfo;
				if (c === i) break;
				if (s === 4) for (s = r.return; s !== null;) {
					var l = s.tag;
					if ((l === 3 || l === 4) && s.stateNode.containerInfo === i) return;
					s = s.return;
				}
				for (; c !== null;) {
					if (s = mt(c), s === null) return;
					if (l = s.tag, l === 5 || l === 6 || l === 26 || l === 27) {
						r = a = s;
						continue a;
					}
					c = c.parentNode;
				}
			}
			r = r.return;
		}
		on(function() {
			var r = a, i = en(n), s = [];
			a: {
				var c = Kr.get(e);
				if (c !== void 0) {
					var l = bn, u = e;
					switch (e) {
						case "keypress": if (hn(n) === 0) break a;
						case "keydown":
						case "keyup":
							l = Rn;
							break;
						case "focusin":
							u = "focus", l = kn;
							break;
						case "focusout":
							u = "blur", l = kn;
							break;
						case "beforeblur":
						case "afterblur":
							l = kn;
							break;
						case "click": if (n.button === 2) break a;
						case "auxclick":
						case "dblclick":
						case "mousedown":
						case "mousemove":
						case "mouseup":
						case "mouseout":
						case "mouseover":
						case "contextmenu":
							l = Dn;
							break;
						case "drag":
						case "dragend":
						case "dragenter":
						case "dragexit":
						case "dragleave":
						case "dragover":
						case "dragstart":
						case "drop":
							l = On;
							break;
						case "touchcancel":
						case "touchend":
						case "touchmove":
						case "touchstart":
							l = Bn;
							break;
						case zr:
						case Br:
						case Vr:
							l = An;
							break;
						case Gr:
							l = Vn;
							break;
						case "scroll":
						case "scrollend":
							l = Sn;
							break;
						case "wheel":
							l = Hn;
							break;
						case "copy":
						case "cut":
						case "paste":
							l = jn;
							break;
						case "gotpointercapture":
						case "lostpointercapture":
						case "pointercancel":
						case "pointerdown":
						case "pointermove":
						case "pointerout":
						case "pointerover":
						case "pointerup":
							l = zn;
							break;
						case "toggle":
						case "beforetoggle": l = Un;
					}
					var d = (t & 4) != 0, f = !d && (e === "scroll" || e === "scrollend"), p = d ? c === null ? null : c + "Capture" : c;
					d = [];
					for (var m = r, h; m !== null;) {
						var g = m;
						if (h = g.stateNode, g = g.tag, g !== 5 && g !== 26 && g !== 27 || h === null || p === null || (g = sn(m, p), g != null && d.push(Td(m, g, h))), f) break;
						m = m.return;
					}
					0 < d.length && (c = new l(c, u, null, n, i), s.push({
						event: c,
						listeners: d
					}));
				}
			}
			if (!(t & 7)) {
				a: {
					if (c = e === "mouseover" || e === "pointerover", l = e === "mouseout" || e === "pointerout", c && n !== $t && (u = n.relatedTarget || n.fromElement) && (mt(u) || u[st])) break a;
					if ((l || c) && (c = i.window === i ? i : (c = i.ownerDocument) ? c.defaultView || c.parentWindow : window, l ? (u = n.relatedTarget || n.toElement, l = r, u = u ? mt(u) : null, u !== null && (f = o(u), d = u.tag, u !== f || d !== 5 && d !== 27 && d !== 6) && (u = null)) : (l = null, u = r), l !== u)) {
						if (d = Dn, g = "onMouseLeave", p = "onMouseEnter", m = "mouse", (e === "pointerout" || e === "pointerover") && (d = zn, g = "onPointerLeave", p = "onPointerEnter", m = "pointer"), f = l == null ? c : gt(l), h = u == null ? c : gt(u), c = new d(g, m + "leave", l, n, i), c.target = f, c.relatedTarget = h, g = null, mt(i) === r && (d = new d(p, m + "enter", u, n, i), d.target = h, d.relatedTarget = f, g = d), f = g, l && u) b: {
							for (d = Dd, p = l, m = u, h = 0, g = p; g; g = d(g)) h++;
							g = 0;
							for (var _ = m; _; _ = d(_)) g++;
							for (; 0 < h - g;) p = d(p), h--;
							for (; 0 < g - h;) m = d(m), g--;
							for (; h--;) {
								if (p === m || m !== null && p === m.alternate) {
									d = p;
									break b;
								}
								p = d(p), m = d(m);
							}
							d = null;
						}
						else d = null;
						l !== null && Od(s, c, l, d, !1), u !== null && f !== null && Od(s, f, u, d, !0);
					}
				}
				a: {
					if (c = r ? gt(r) : window, l = c.nodeName && c.nodeName.toLowerCase(), l === "select" || l === "input" && c.type === "file") var v = lr;
					else if (rr(c)) if (ur) v = yr;
					else {
						v = _r;
						var y = gr;
					}
					else l = c.nodeName, !l || l.toLowerCase() !== "input" || c.type !== "checkbox" && c.type !== "radio" ? r && Jt(r.elementType) && (v = lr) : v = vr;
					if (v &&= v(e, r)) {
						ir(s, v, n, i);
						break a;
					}
					y && y(e, c, r), e === "focusout" && r && c.type === "number" && r.memoizedProps.value != null && Bt(c, "number", c.value);
				}
				switch (y = r ? gt(r) : window, e) {
					case "focusin":
						(rr(y) || y.contentEditable === "true") && (kr = y, Ar = r, jr = null);
						break;
					case "focusout":
						jr = Ar = kr = null;
						break;
					case "mousedown":
						Mr = !0;
						break;
					case "contextmenu":
					case "mouseup":
					case "dragend":
						Mr = !1, Nr(s, n, i);
						break;
					case "selectionchange": if (Or) break;
					case "keydown":
					case "keyup": Nr(s, n, i);
				}
				var b;
				if (Gn) b: {
					switch (e) {
						case "compositionstart":
							var x = "onCompositionStart";
							break b;
						case "compositionend":
							x = "onCompositionEnd";
							break b;
						case "compositionupdate":
							x = "onCompositionUpdate";
							break b;
					}
					x = void 0;
				}
				else $n ? Zn(e, n) && (x = "onCompositionEnd") : e === "keydown" && n.keyCode === 229 && (x = "onCompositionStart");
				x && (Jn && n.locale !== "ko" && ($n || x !== "onCompositionStart" ? x === "onCompositionEnd" && $n && (b = mn()) : (dn = i, fn = "value" in dn ? dn.value : dn.textContent, $n = !0)), y = Ed(r, x), 0 < y.length && (x = new Mn(x, e, null, n, i), s.push({
					event: x,
					listeners: y
				}), b ? x.data = b : (b = Qn(n), b !== null && (x.data = b)))), (b = qn ? er(e, n) : tr(e, n)) && (x = Ed(r, "onBeforeInput"), 0 < x.length && (y = new Mn("onBeforeInput", "beforeinput", null, n, i), s.push({
					event: y,
					listeners: x
				}), y.data = b)), md(s, e, r, n, i);
			}
			yd(s, t);
		});
	}
	function Td(e, t, n) {
		return {
			instance: e,
			listener: t,
			currentTarget: n
		};
	}
	function Ed(e, t) {
		for (var n = t + "Capture", r = []; e !== null;) {
			var i = e, a = i.stateNode;
			if (i = i.tag, i !== 5 && i !== 26 && i !== 27 || a === null || (i = sn(e, n), i != null && r.unshift(Td(e, i, a)), i = sn(e, t), i != null && r.push(Td(e, i, a))), e.tag === 3) return r;
			e = e.return;
		}
		return [];
	}
	function Dd(e) {
		if (e === null) return null;
		do
			e = e.return;
		while (e && e.tag !== 5 && e.tag !== 27);
		return e || null;
	}
	function Od(e, t, n, r, i) {
		for (var a = t._reactName, o = []; n !== null && n !== r;) {
			var s = n, c = s.alternate, l = s.stateNode;
			if (s = s.tag, c !== null && c === r) break;
			s !== 5 && s !== 26 && s !== 27 || l === null || (c = l, i ? (l = sn(n, a), l != null && o.unshift(Td(n, l, c))) : i || (l = sn(n, a), l != null && o.push(Td(n, l, c)))), n = n.return;
		}
		o.length !== 0 && e.push({
			event: t,
			listeners: o
		});
	}
	var kd = /\r\n?/g, Ad = /\u0000|\uFFFD/g;
	function jd(e) {
		return (typeof e == "string" ? e : "" + e).replace(kd, "\n").replace(Ad, "");
	}
	function Md(e, t) {
		return t = jd(t), jd(e) === t;
	}
	function $(e, t, n, r, a, o) {
		switch (n) {
			case "children":
				typeof r == "string" ? t === "body" || t === "textarea" && r === "" || Wt(e, r) : (typeof r == "number" || typeof r == "bigint") && t !== "body" && Wt(e, "" + r);
				break;
			case "className":
				Ot(e, "class", r);
				break;
			case "tabIndex":
				Ot(e, "tabindex", r);
				break;
			case "dir":
			case "role":
			case "viewBox":
			case "width":
			case "height":
				Ot(e, n, r);
				break;
			case "style":
				qt(e, r, o);
				break;
			case "data": if (t !== "object") {
				Ot(e, "data", r);
				break;
			}
			case "src":
			case "href":
				if (r === "" && (t !== "a" || n !== "href")) {
					e.removeAttribute(n);
					break;
				}
				if (r == null || typeof r == "function" || typeof r == "symbol" || typeof r == "boolean") {
					e.removeAttribute(n);
					break;
				}
				r = Zt("" + r), e.setAttribute(n, r);
				break;
			case "action":
			case "formAction":
				if (typeof r == "function") {
					e.setAttribute(n, "javascript:throw new Error('A React form was unexpectedly submitted. If you called form.submit() manually, consider using form.requestSubmit() instead. If you\\'re trying to use event.stopPropagation() in a submit event handler, consider also calling event.preventDefault().')");
					break;
				} else typeof o == "function" && (n === "formAction" ? (t !== "input" && $(e, t, "name", a.name, a, null), $(e, t, "formEncType", a.formEncType, a, null), $(e, t, "formMethod", a.formMethod, a, null), $(e, t, "formTarget", a.formTarget, a, null)) : ($(e, t, "encType", a.encType, a, null), $(e, t, "method", a.method, a, null), $(e, t, "target", a.target, a, null)));
				if (r == null || typeof r == "symbol" || typeof r == "boolean") {
					e.removeAttribute(n);
					break;
				}
				r = Zt("" + r), e.setAttribute(n, r);
				break;
			case "onClick":
				r != null && (e.onclick = Qt);
				break;
			case "onScroll":
				r != null && Q("scroll", e);
				break;
			case "onScrollEnd":
				r != null && Q("scrollend", e);
				break;
			case "dangerouslySetInnerHTML":
				if (r != null) {
					if (typeof r != "object" || !("__html" in r)) throw Error(i(61));
					if (n = r.__html, n != null) {
						if (a.children != null) throw Error(i(60));
						e.innerHTML = n;
					}
				}
				break;
			case "multiple":
				e.multiple = r && typeof r != "function" && typeof r != "symbol";
				break;
			case "muted":
				e.muted = r && typeof r != "function" && typeof r != "symbol";
				break;
			case "suppressContentEditableWarning":
			case "suppressHydrationWarning":
			case "defaultValue":
			case "defaultChecked":
			case "innerHTML":
			case "ref": break;
			case "autoFocus": break;
			case "xlinkHref":
				if (r == null || typeof r == "function" || typeof r == "boolean" || typeof r == "symbol") {
					e.removeAttribute("xlink:href");
					break;
				}
				n = Zt("" + r), e.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", n);
				break;
			case "contentEditable":
			case "spellCheck":
			case "draggable":
			case "value":
			case "autoReverse":
			case "externalResourcesRequired":
			case "focusable":
			case "preserveAlpha":
				r != null && typeof r != "function" && typeof r != "symbol" ? e.setAttribute(n, "" + r) : e.removeAttribute(n);
				break;
			case "inert":
			case "allowFullScreen":
			case "async":
			case "autoPlay":
			case "controls":
			case "default":
			case "defer":
			case "disabled":
			case "disablePictureInPicture":
			case "disableRemotePlayback":
			case "formNoValidate":
			case "hidden":
			case "loop":
			case "noModule":
			case "noValidate":
			case "open":
			case "playsInline":
			case "readOnly":
			case "required":
			case "reversed":
			case "scoped":
			case "seamless":
			case "itemScope":
				r && typeof r != "function" && typeof r != "symbol" ? e.setAttribute(n, "") : e.removeAttribute(n);
				break;
			case "capture":
			case "download":
				!0 === r ? e.setAttribute(n, "") : !1 !== r && r != null && typeof r != "function" && typeof r != "symbol" ? e.setAttribute(n, r) : e.removeAttribute(n);
				break;
			case "cols":
			case "rows":
			case "size":
			case "span":
				r != null && typeof r != "function" && typeof r != "symbol" && !isNaN(r) && 1 <= r ? e.setAttribute(n, r) : e.removeAttribute(n);
				break;
			case "rowSpan":
			case "start":
				r == null || typeof r == "function" || typeof r == "symbol" || isNaN(r) ? e.removeAttribute(n) : e.setAttribute(n, r);
				break;
			case "popover":
				Q("beforetoggle", e), Q("toggle", e), Dt(e, "popover", r);
				break;
			case "xlinkActuate":
				kt(e, "http://www.w3.org/1999/xlink", "xlink:actuate", r);
				break;
			case "xlinkArcrole":
				kt(e, "http://www.w3.org/1999/xlink", "xlink:arcrole", r);
				break;
			case "xlinkRole":
				kt(e, "http://www.w3.org/1999/xlink", "xlink:role", r);
				break;
			case "xlinkShow":
				kt(e, "http://www.w3.org/1999/xlink", "xlink:show", r);
				break;
			case "xlinkTitle":
				kt(e, "http://www.w3.org/1999/xlink", "xlink:title", r);
				break;
			case "xlinkType":
				kt(e, "http://www.w3.org/1999/xlink", "xlink:type", r);
				break;
			case "xmlBase":
				kt(e, "http://www.w3.org/XML/1998/namespace", "xml:base", r);
				break;
			case "xmlLang":
				kt(e, "http://www.w3.org/XML/1998/namespace", "xml:lang", r);
				break;
			case "xmlSpace":
				kt(e, "http://www.w3.org/XML/1998/namespace", "xml:space", r);
				break;
			case "is":
				Dt(e, "is", r);
				break;
			case "innerText":
			case "textContent": break;
			default: (!(2 < n.length) || n[0] !== "o" && n[0] !== "O" || n[1] !== "n" && n[1] !== "N") && (n = Yt.get(n) || n, Dt(e, n, r));
		}
	}
	function Nd(e, t, n, r, a, o) {
		switch (n) {
			case "style":
				qt(e, r, o);
				break;
			case "dangerouslySetInnerHTML":
				if (r != null) {
					if (typeof r != "object" || !("__html" in r)) throw Error(i(61));
					if (n = r.__html, n != null) {
						if (a.children != null) throw Error(i(60));
						e.innerHTML = n;
					}
				}
				break;
			case "children":
				typeof r == "string" ? Wt(e, r) : (typeof r == "number" || typeof r == "bigint") && Wt(e, "" + r);
				break;
			case "onScroll":
				r != null && Q("scroll", e);
				break;
			case "onScrollEnd":
				r != null && Q("scrollend", e);
				break;
			case "onClick":
				r != null && (e.onclick = Qt);
				break;
			case "suppressContentEditableWarning":
			case "suppressHydrationWarning":
			case "innerHTML":
			case "ref": break;
			case "innerText":
			case "textContent": break;
			default: if (!bt.hasOwnProperty(n)) a: {
				if (n[0] === "o" && n[1] === "n" && (a = n.endsWith("Capture"), t = n.slice(2, a ? n.length - 7 : void 0), o = e[ot] || null, o = o == null ? null : o[n], typeof o == "function" && e.removeEventListener(t, o, a), typeof r == "function")) {
					typeof o != "function" && o !== null && (n in e ? e[n] = null : e.hasAttribute(n) && e.removeAttribute(n)), e.addEventListener(t, r, a);
					break a;
				}
				n in e ? e[n] = r : !0 === r ? e.setAttribute(n, "") : Dt(e, n, r);
			}
		}
	}
	function Pd(e, t, n) {
		switch (t) {
			case "div":
			case "span":
			case "svg":
			case "path":
			case "a":
			case "g":
			case "p":
			case "li": break;
			case "img":
				Q("error", e), Q("load", e);
				var r = !1, a = !1, o;
				for (o in n) if (n.hasOwnProperty(o)) {
					var s = n[o];
					if (s != null) switch (o) {
						case "src":
							r = !0;
							break;
						case "srcSet":
							a = !0;
							break;
						case "children":
						case "dangerouslySetInnerHTML": throw Error(i(137, t));
						default: $(e, t, o, s, n, null);
					}
				}
				a && $(e, t, "srcSet", n.srcSet, n, null), r && $(e, t, "src", n.src, n, null);
				return;
			case "input":
				Q("invalid", e);
				var c = o = s = a = null, l = null, u = null;
				for (r in n) if (n.hasOwnProperty(r)) {
					var d = n[r];
					if (d != null) switch (r) {
						case "name":
							a = d;
							break;
						case "type":
							s = d;
							break;
						case "checked":
							l = d;
							break;
						case "defaultChecked":
							u = d;
							break;
						case "value":
							o = d;
							break;
						case "defaultValue":
							c = d;
							break;
						case "children":
						case "dangerouslySetInnerHTML":
							if (d != null) throw Error(i(137, t));
							break;
						default: $(e, t, r, d, n, null);
					}
				}
				zt(e, o, c, l, u, s, a, !1);
				return;
			case "select":
				for (a in Q("invalid", e), r = s = o = null, n) if (n.hasOwnProperty(a) && (c = n[a], c != null)) switch (a) {
					case "value":
						o = c;
						break;
					case "defaultValue":
						s = c;
						break;
					case "multiple": r = c;
					default: $(e, t, a, c, n, null);
				}
				t = o, n = s, e.multiple = !!r, t == null ? n != null && Vt(e, !!r, n, !0) : Vt(e, !!r, t, !1);
				return;
			case "textarea":
				for (s in Q("invalid", e), o = a = r = null, n) if (n.hasOwnProperty(s) && (c = n[s], c != null)) switch (s) {
					case "value":
						r = c;
						break;
					case "defaultValue":
						a = c;
						break;
					case "children":
						o = c;
						break;
					case "dangerouslySetInnerHTML":
						if (c != null) throw Error(i(91));
						break;
					default: $(e, t, s, c, n, null);
				}
				Ut(e, r, a, o);
				return;
			case "option":
				for (l in n) if (n.hasOwnProperty(l) && (r = n[l], r != null)) switch (l) {
					case "selected":
						e.selected = r && typeof r != "function" && typeof r != "symbol";
						break;
					default: $(e, t, l, r, n, null);
				}
				return;
			case "dialog":
				Q("beforetoggle", e), Q("toggle", e), Q("cancel", e), Q("close", e);
				break;
			case "iframe":
			case "object":
				Q("load", e);
				break;
			case "video":
			case "audio":
				for (r = 0; r < _d.length; r++) Q(_d[r], e);
				break;
			case "image":
				Q("error", e), Q("load", e);
				break;
			case "details":
				Q("toggle", e);
				break;
			case "embed":
			case "source":
			case "link": Q("error", e), Q("load", e);
			case "area":
			case "base":
			case "br":
			case "col":
			case "hr":
			case "keygen":
			case "meta":
			case "param":
			case "track":
			case "wbr":
			case "menuitem":
				for (u in n) if (n.hasOwnProperty(u) && (r = n[u], r != null)) switch (u) {
					case "children":
					case "dangerouslySetInnerHTML": throw Error(i(137, t));
					default: $(e, t, u, r, n, null);
				}
				return;
			default: if (Jt(t)) {
				for (d in n) n.hasOwnProperty(d) && (r = n[d], r !== void 0 && Nd(e, t, d, r, n, void 0));
				return;
			}
		}
		for (c in n) n.hasOwnProperty(c) && (r = n[c], r != null && $(e, t, c, r, n, null));
	}
	function Fd(e, t, n, r) {
		switch (t) {
			case "div":
			case "span":
			case "svg":
			case "path":
			case "a":
			case "g":
			case "p":
			case "li": break;
			case "input":
				var a = null, o = null, s = null, c = null, l = null, u = null, d = null;
				for (m in n) {
					var f = n[m];
					if (n.hasOwnProperty(m) && f != null) switch (m) {
						case "checked": break;
						case "value": break;
						case "defaultValue": l = f;
						default: r.hasOwnProperty(m) || $(e, t, m, null, r, f);
					}
				}
				for (var p in r) {
					var m = r[p];
					if (f = n[p], r.hasOwnProperty(p) && (m != null || f != null)) switch (p) {
						case "type":
							o = m;
							break;
						case "name":
							a = m;
							break;
						case "checked":
							u = m;
							break;
						case "defaultChecked":
							d = m;
							break;
						case "value":
							s = m;
							break;
						case "defaultValue":
							c = m;
							break;
						case "children":
						case "dangerouslySetInnerHTML":
							if (m != null) throw Error(i(137, t));
							break;
						default: m !== f && $(e, t, p, m, r, f);
					}
				}
				Rt(e, s, c, l, u, d, o, a);
				return;
			case "select":
				for (o in m = s = c = p = null, n) if (l = n[o], n.hasOwnProperty(o) && l != null) switch (o) {
					case "value": break;
					case "multiple": m = l;
					default: r.hasOwnProperty(o) || $(e, t, o, null, r, l);
				}
				for (a in r) if (o = r[a], l = n[a], r.hasOwnProperty(a) && (o != null || l != null)) switch (a) {
					case "value":
						p = o;
						break;
					case "defaultValue":
						c = o;
						break;
					case "multiple": s = o;
					default: o !== l && $(e, t, a, o, r, l);
				}
				t = c, n = s, r = m, p == null ? !!r != !!n && (t == null ? Vt(e, !!n, n ? [] : "", !1) : Vt(e, !!n, t, !0)) : Vt(e, !!n, p, !1);
				return;
			case "textarea":
				for (c in m = p = null, n) if (a = n[c], n.hasOwnProperty(c) && a != null && !r.hasOwnProperty(c)) switch (c) {
					case "value": break;
					case "children": break;
					default: $(e, t, c, null, r, a);
				}
				for (s in r) if (a = r[s], o = n[s], r.hasOwnProperty(s) && (a != null || o != null)) switch (s) {
					case "value":
						p = a;
						break;
					case "defaultValue":
						m = a;
						break;
					case "children": break;
					case "dangerouslySetInnerHTML":
						if (a != null) throw Error(i(91));
						break;
					default: a !== o && $(e, t, s, a, r, o);
				}
				Ht(e, p, m);
				return;
			case "option":
				for (var h in n) if (p = n[h], n.hasOwnProperty(h) && p != null && !r.hasOwnProperty(h)) switch (h) {
					case "selected":
						e.selected = !1;
						break;
					default: $(e, t, h, null, r, p);
				}
				for (l in r) if (p = r[l], m = n[l], r.hasOwnProperty(l) && p !== m && (p != null || m != null)) switch (l) {
					case "selected":
						e.selected = p && typeof p != "function" && typeof p != "symbol";
						break;
					default: $(e, t, l, p, r, m);
				}
				return;
			case "img":
			case "link":
			case "area":
			case "base":
			case "br":
			case "col":
			case "embed":
			case "hr":
			case "keygen":
			case "meta":
			case "param":
			case "source":
			case "track":
			case "wbr":
			case "menuitem":
				for (var g in n) p = n[g], n.hasOwnProperty(g) && p != null && !r.hasOwnProperty(g) && $(e, t, g, null, r, p);
				for (u in r) if (p = r[u], m = n[u], r.hasOwnProperty(u) && p !== m && (p != null || m != null)) switch (u) {
					case "children":
					case "dangerouslySetInnerHTML":
						if (p != null) throw Error(i(137, t));
						break;
					default: $(e, t, u, p, r, m);
				}
				return;
			default: if (Jt(t)) {
				for (var _ in n) p = n[_], n.hasOwnProperty(_) && p !== void 0 && !r.hasOwnProperty(_) && Nd(e, t, _, void 0, r, p);
				for (d in r) p = r[d], m = n[d], !r.hasOwnProperty(d) || p === m || p === void 0 && m === void 0 || Nd(e, t, d, p, r, m);
				return;
			}
		}
		for (var v in n) p = n[v], n.hasOwnProperty(v) && p != null && !r.hasOwnProperty(v) && $(e, t, v, null, r, p);
		for (f in r) p = r[f], m = n[f], !r.hasOwnProperty(f) || p === m || p == null && m == null || $(e, t, f, p, r, m);
	}
	function Id(e) {
		switch (e) {
			case "css":
			case "script":
			case "font":
			case "img":
			case "image":
			case "input":
			case "link": return !0;
			default: return !1;
		}
	}
	function Ld() {
		if (typeof performance.getEntriesByType == "function") {
			for (var e = 0, t = 0, n = performance.getEntriesByType("resource"), r = 0; r < n.length; r++) {
				var i = n[r], a = i.transferSize, o = i.initiatorType, s = i.duration;
				if (a && s && Id(o)) {
					for (o = 0, s = i.responseEnd, r += 1; r < n.length; r++) {
						var c = n[r], l = c.startTime;
						if (l > s) break;
						var u = c.transferSize, d = c.initiatorType;
						u && Id(d) && (c = c.responseEnd, o += u * (c < s ? 1 : (s - l) / (c - l)));
					}
					if (--r, t += 8 * (a + o) / (i.duration / 1e3), e++, 10 < e) break;
				}
			}
			if (0 < e) return t / e / 1e6;
		}
		return navigator.connection && (e = navigator.connection.downlink, typeof e == "number") ? e : 5;
	}
	var Rd = null, zd = null;
	function Bd(e) {
		return e.nodeType === 9 ? e : e.ownerDocument;
	}
	function Vd(e) {
		switch (e) {
			case "http://www.w3.org/2000/svg": return 1;
			case "http://www.w3.org/1998/Math/MathML": return 2;
			default: return 0;
		}
	}
	function Hd(e, t) {
		if (e === 0) switch (t) {
			case "svg": return 1;
			case "math": return 2;
			default: return 0;
		}
		return e === 1 && t === "foreignObject" ? 0 : e;
	}
	function Ud(e, t) {
		return e === "textarea" || e === "noscript" || typeof t.children == "string" || typeof t.children == "number" || typeof t.children == "bigint" || typeof t.dangerouslySetInnerHTML == "object" && t.dangerouslySetInnerHTML !== null && t.dangerouslySetInnerHTML.__html != null;
	}
	var Wd = null;
	function Gd() {
		var e = window.event;
		return e && e.type === "popstate" ? e === Wd ? !1 : (Wd = e, !0) : (Wd = null, !1);
	}
	var Kd = typeof setTimeout == "function" ? setTimeout : void 0, qd = typeof clearTimeout == "function" ? clearTimeout : void 0, Jd = typeof Promise == "function" ? Promise : void 0, Yd = typeof queueMicrotask == "function" ? queueMicrotask : Jd === void 0 ? Kd : function(e) {
		return Jd.resolve(null).then(e).catch(Xd);
	};
	function Xd(e) {
		setTimeout(function() {
			throw e;
		});
	}
	function Zd(e) {
		return e === "head";
	}
	function Qd(e, t) {
		var n = t, r = 0;
		do {
			var i = n.nextSibling;
			if (e.removeChild(n), i && i.nodeType === 8) if (n = i.data, n === "/$" || n === "/&") {
				if (r === 0) {
					e.removeChild(i), Np(t);
					return;
				}
				r--;
			} else if (n === "$" || n === "$?" || n === "$~" || n === "$!" || n === "&") r++;
			else if (n === "html") pf(e.ownerDocument.documentElement);
			else if (n === "head") {
				n = e.ownerDocument.head, pf(n);
				for (var a = n.firstChild; a;) {
					var o = a.nextSibling, s = a.nodeName;
					a[ft] || s === "SCRIPT" || s === "STYLE" || s === "LINK" && a.rel.toLowerCase() === "stylesheet" || n.removeChild(a), a = o;
				}
			} else n === "body" && pf(e.ownerDocument.body);
			n = i;
		} while (n);
		Np(t);
	}
	function $d(e, t) {
		var n = e;
		e = 0;
		do {
			var r = n.nextSibling;
			if (n.nodeType === 1 ? t ? (n._stashedDisplay = n.style.display, n.style.display = "none") : (n.style.display = n._stashedDisplay || "", n.getAttribute("style") === "" && n.removeAttribute("style")) : n.nodeType === 3 && (t ? (n._stashedText = n.nodeValue, n.nodeValue = "") : n.nodeValue = n._stashedText || ""), r && r.nodeType === 8) if (n = r.data, n === "/$") {
				if (e === 0) break;
				e--;
			} else n !== "$" && n !== "$?" && n !== "$~" && n !== "$!" || e++;
			n = r;
		} while (n);
	}
	function ef(e) {
		var t = e.firstChild;
		for (t && t.nodeType === 10 && (t = t.nextSibling); t;) {
			var n = t;
			switch (t = t.nextSibling, n.nodeName) {
				case "HTML":
				case "HEAD":
				case "BODY":
					ef(n), pt(n);
					continue;
				case "SCRIPT":
				case "STYLE": continue;
				case "LINK": if (n.rel.toLowerCase() === "stylesheet") continue;
			}
			e.removeChild(n);
		}
	}
	function tf(e, t, n, r) {
		for (; e.nodeType === 1;) {
			var i = n;
			if (e.nodeName.toLowerCase() !== t.toLowerCase()) {
				if (!r && (e.nodeName !== "INPUT" || e.type !== "hidden")) break;
			} else if (!r) if (t === "input" && e.type === "hidden") {
				var a = i.name == null ? null : "" + i.name;
				if (i.type === "hidden" && e.getAttribute("name") === a) return e;
			} else return e;
			else if (!e[ft]) switch (t) {
				case "meta":
					if (!e.hasAttribute("itemprop")) break;
					return e;
				case "link":
					if (a = e.getAttribute("rel"), a === "stylesheet" && e.hasAttribute("data-precedence") || a !== i.rel || e.getAttribute("href") !== (i.href == null || i.href === "" ? null : i.href) || e.getAttribute("crossorigin") !== (i.crossOrigin == null ? null : i.crossOrigin) || e.getAttribute("title") !== (i.title == null ? null : i.title)) break;
					return e;
				case "style":
					if (e.hasAttribute("data-precedence")) break;
					return e;
				case "script":
					if (a = e.getAttribute("src"), (a !== (i.src == null ? null : i.src) || e.getAttribute("type") !== (i.type == null ? null : i.type) || e.getAttribute("crossorigin") !== (i.crossOrigin == null ? null : i.crossOrigin)) && a && e.hasAttribute("async") && !e.hasAttribute("itemprop")) break;
					return e;
				default: return e;
			}
			if (e = cf(e.nextSibling), e === null) break;
		}
		return null;
	}
	function nf(e, t, n) {
		if (t === "") return null;
		for (; e.nodeType !== 3;) if ((e.nodeType !== 1 || e.nodeName !== "INPUT" || e.type !== "hidden") && !n || (e = cf(e.nextSibling), e === null)) return null;
		return e;
	}
	function rf(e, t) {
		for (; e.nodeType !== 8;) if ((e.nodeType !== 1 || e.nodeName !== "INPUT" || e.type !== "hidden") && !t || (e = cf(e.nextSibling), e === null)) return null;
		return e;
	}
	function af(e) {
		return e.data === "$?" || e.data === "$~";
	}
	function of(e) {
		return e.data === "$!" || e.data === "$?" && e.ownerDocument.readyState !== "loading";
	}
	function sf(e, t) {
		var n = e.ownerDocument;
		if (e.data === "$~") e._reactRetry = t;
		else if (e.data !== "$?" || n.readyState !== "loading") t();
		else {
			var r = function() {
				t(), n.removeEventListener("DOMContentLoaded", r);
			};
			n.addEventListener("DOMContentLoaded", r), e._reactRetry = r;
		}
	}
	function cf(e) {
		for (; e != null; e = e.nextSibling) {
			var t = e.nodeType;
			if (t === 1 || t === 3) break;
			if (t === 8) {
				if (t = e.data, t === "$" || t === "$!" || t === "$?" || t === "$~" || t === "&" || t === "F!" || t === "F") break;
				if (t === "/$" || t === "/&") return null;
			}
		}
		return e;
	}
	var lf = null;
	function uf(e) {
		e = e.nextSibling;
		for (var t = 0; e;) {
			if (e.nodeType === 8) {
				var n = e.data;
				if (n === "/$" || n === "/&") {
					if (t === 0) return cf(e.nextSibling);
					t--;
				} else n !== "$" && n !== "$!" && n !== "$?" && n !== "$~" && n !== "&" || t++;
			}
			e = e.nextSibling;
		}
		return null;
	}
	function df(e) {
		e = e.previousSibling;
		for (var t = 0; e;) {
			if (e.nodeType === 8) {
				var n = e.data;
				if (n === "$" || n === "$!" || n === "$?" || n === "$~" || n === "&") {
					if (t === 0) return e;
					t--;
				} else n !== "/$" && n !== "/&" || t++;
			}
			e = e.previousSibling;
		}
		return null;
	}
	function ff(e, t, n) {
		switch (t = Bd(n), e) {
			case "html":
				if (e = t.documentElement, !e) throw Error(i(452));
				return e;
			case "head":
				if (e = t.head, !e) throw Error(i(453));
				return e;
			case "body":
				if (e = t.body, !e) throw Error(i(454));
				return e;
			default: throw Error(i(451));
		}
	}
	function pf(e) {
		for (var t = e.attributes; t.length;) e.removeAttributeNode(t[0]);
		pt(e);
	}
	var mf = /* @__PURE__ */ new Map(), hf = /* @__PURE__ */ new Set();
	function gf(e) {
		return typeof e.getRootNode == "function" ? e.getRootNode() : e.nodeType === 9 ? e : e.ownerDocument;
	}
	var _f = F.d;
	F.d = {
		f: vf,
		r: yf,
		D: Sf,
		C: Cf,
		L: wf,
		m: Tf,
		X: Df,
		S: Ef,
		M: Of
	};
	function vf() {
		var e = _f.f(), t = bu();
		return e || t;
	}
	function yf(e) {
		var t = ht(e);
		t !== null && t.tag === 5 && t.type === "form" ? Es(t) : _f.r(e);
	}
	var bf = typeof document > "u" ? null : document;
	function xf(e, t, n) {
		var r = bf;
		if (r && typeof t == "string" && t) {
			var i = Lt(t);
			i = "link[rel=\"" + e + "\"][href=\"" + i + "\"]", typeof n == "string" && (i += "[crossorigin=\"" + n + "\"]"), hf.has(i) || (hf.add(i), e = {
				rel: e,
				crossOrigin: n,
				href: t
			}, r.querySelector(i) === null && (t = r.createElement("link"), Pd(t, "link", e), vt(t), r.head.appendChild(t)));
		}
	}
	function Sf(e) {
		_f.D(e), xf("dns-prefetch", e, null);
	}
	function Cf(e, t) {
		_f.C(e, t), xf("preconnect", e, t);
	}
	function wf(e, t, n) {
		_f.L(e, t, n);
		var r = bf;
		if (r && e && t) {
			var i = "link[rel=\"preload\"][as=\"" + Lt(t) + "\"]";
			t === "image" && n && n.imageSrcSet ? (i += "[imagesrcset=\"" + Lt(n.imageSrcSet) + "\"]", typeof n.imageSizes == "string" && (i += "[imagesizes=\"" + Lt(n.imageSizes) + "\"]")) : i += "[href=\"" + Lt(e) + "\"]";
			var a = i;
			switch (t) {
				case "style":
					a = Af(e);
					break;
				case "script": a = Pf(e);
			}
			mf.has(a) || (e = h({
				rel: "preload",
				href: t === "image" && n && n.imageSrcSet ? void 0 : e,
				as: t
			}, n), mf.set(a, e), r.querySelector(i) !== null || t === "style" && r.querySelector(jf(a)) || t === "script" && r.querySelector(Ff(a)) || (t = r.createElement("link"), Pd(t, "link", e), vt(t), r.head.appendChild(t)));
		}
	}
	function Tf(e, t) {
		_f.m(e, t);
		var n = bf;
		if (n && e) {
			var r = t && typeof t.as == "string" ? t.as : "script", i = "link[rel=\"modulepreload\"][as=\"" + Lt(r) + "\"][href=\"" + Lt(e) + "\"]", a = i;
			switch (r) {
				case "audioworklet":
				case "paintworklet":
				case "serviceworker":
				case "sharedworker":
				case "worker":
				case "script": a = Pf(e);
			}
			if (!mf.has(a) && (e = h({
				rel: "modulepreload",
				href: e
			}, t), mf.set(a, e), n.querySelector(i) === null)) {
				switch (r) {
					case "audioworklet":
					case "paintworklet":
					case "serviceworker":
					case "sharedworker":
					case "worker":
					case "script": if (n.querySelector(Ff(a))) return;
				}
				r = n.createElement("link"), Pd(r, "link", e), vt(r), n.head.appendChild(r);
			}
		}
	}
	function Ef(e, t, n) {
		_f.S(e, t, n);
		var r = bf;
		if (r && e) {
			var i = _t(r).hoistableStyles, a = Af(e);
			t ||= "default";
			var o = i.get(a);
			if (!o) {
				var s = {
					loading: 0,
					preload: null
				};
				if (o = r.querySelector(jf(a))) s.loading = 5;
				else {
					e = h({
						rel: "stylesheet",
						href: e,
						"data-precedence": t
					}, n), (n = mf.get(a)) && Rf(e, n);
					var c = o = r.createElement("link");
					vt(c), Pd(c, "link", e), c._p = new Promise(function(e, t) {
						c.onload = e, c.onerror = t;
					}), c.addEventListener("load", function() {
						s.loading |= 1;
					}), c.addEventListener("error", function() {
						s.loading |= 2;
					}), s.loading |= 4, Lf(o, t, r);
				}
				o = {
					type: "stylesheet",
					instance: o,
					count: 1,
					state: s
				}, i.set(a, o);
			}
		}
	}
	function Df(e, t) {
		_f.X(e, t);
		var n = bf;
		if (n && e) {
			var r = _t(n).hoistableScripts, i = Pf(e), a = r.get(i);
			a || (a = n.querySelector(Ff(i)), a || (e = h({
				src: e,
				async: !0
			}, t), (t = mf.get(i)) && zf(e, t), a = n.createElement("script"), vt(a), Pd(a, "link", e), n.head.appendChild(a)), a = {
				type: "script",
				instance: a,
				count: 1,
				state: null
			}, r.set(i, a));
		}
	}
	function Of(e, t) {
		_f.M(e, t);
		var n = bf;
		if (n && e) {
			var r = _t(n).hoistableScripts, i = Pf(e), a = r.get(i);
			a || (a = n.querySelector(Ff(i)), a || (e = h({
				src: e,
				async: !0,
				type: "module"
			}, t), (t = mf.get(i)) && zf(e, t), a = n.createElement("script"), vt(a), Pd(a, "link", e), n.head.appendChild(a)), a = {
				type: "script",
				instance: a,
				count: 1,
				state: null
			}, r.set(i, a));
		}
	}
	function kf(e, t, n, r) {
		var a = (a = z.current) ? gf(a) : null;
		if (!a) throw Error(i(446));
		switch (e) {
			case "meta":
			case "title": return null;
			case "style": return typeof n.precedence == "string" && typeof n.href == "string" ? (t = Af(n.href), n = _t(a).hoistableStyles, r = n.get(t), r || (r = {
				type: "style",
				instance: null,
				count: 0,
				state: null
			}, n.set(t, r)), r) : {
				type: "void",
				instance: null,
				count: 0,
				state: null
			};
			case "link":
				if (n.rel === "stylesheet" && typeof n.href == "string" && typeof n.precedence == "string") {
					e = Af(n.href);
					var o = _t(a).hoistableStyles, s = o.get(e);
					if (s || (a = a.ownerDocument || a, s = {
						type: "stylesheet",
						instance: null,
						count: 0,
						state: {
							loading: 0,
							preload: null
						}
					}, o.set(e, s), (o = a.querySelector(jf(e))) && !o._p && (s.instance = o, s.state.loading = 5), mf.has(e) || (n = {
						rel: "preload",
						as: "style",
						href: n.href,
						crossOrigin: n.crossOrigin,
						integrity: n.integrity,
						media: n.media,
						hrefLang: n.hrefLang,
						referrerPolicy: n.referrerPolicy
					}, mf.set(e, n), o || Nf(a, e, n, s.state))), t && r === null) throw Error(i(528, ""));
					return s;
				}
				if (t && r !== null) throw Error(i(529, ""));
				return null;
			case "script": return t = n.async, n = n.src, typeof n == "string" && t && typeof t != "function" && typeof t != "symbol" ? (t = Pf(n), n = _t(a).hoistableScripts, r = n.get(t), r || (r = {
				type: "script",
				instance: null,
				count: 0,
				state: null
			}, n.set(t, r)), r) : {
				type: "void",
				instance: null,
				count: 0,
				state: null
			};
			default: throw Error(i(444, e));
		}
	}
	function Af(e) {
		return "href=\"" + Lt(e) + "\"";
	}
	function jf(e) {
		return "link[rel=\"stylesheet\"][" + e + "]";
	}
	function Mf(e) {
		return h({}, e, {
			"data-precedence": e.precedence,
			precedence: null
		});
	}
	function Nf(e, t, n, r) {
		e.querySelector("link[rel=\"preload\"][as=\"style\"][" + t + "]") ? r.loading = 1 : (t = e.createElement("link"), r.preload = t, t.addEventListener("load", function() {
			return r.loading |= 1;
		}), t.addEventListener("error", function() {
			return r.loading |= 2;
		}), Pd(t, "link", n), vt(t), e.head.appendChild(t));
	}
	function Pf(e) {
		return "[src=\"" + Lt(e) + "\"]";
	}
	function Ff(e) {
		return "script[async]" + e;
	}
	function If(e, t, n) {
		if (t.count++, t.instance === null) switch (t.type) {
			case "style":
				var r = e.querySelector("style[data-href~=\"" + Lt(n.href) + "\"]");
				if (r) return t.instance = r, vt(r), r;
				var a = h({}, n, {
					"data-href": n.href,
					"data-precedence": n.precedence,
					href: null,
					precedence: null
				});
				return r = (e.ownerDocument || e).createElement("style"), vt(r), Pd(r, "style", a), Lf(r, n.precedence, e), t.instance = r;
			case "stylesheet":
				a = Af(n.href);
				var o = e.querySelector(jf(a));
				if (o) return t.state.loading |= 4, t.instance = o, vt(o), o;
				r = Mf(n), (a = mf.get(a)) && Rf(r, a), o = (e.ownerDocument || e).createElement("link"), vt(o);
				var s = o;
				return s._p = new Promise(function(e, t) {
					s.onload = e, s.onerror = t;
				}), Pd(o, "link", r), t.state.loading |= 4, Lf(o, n.precedence, e), t.instance = o;
			case "script": return o = Pf(n.src), (a = e.querySelector(Ff(o))) ? (t.instance = a, vt(a), a) : (r = n, (a = mf.get(o)) && (r = h({}, n), zf(r, a)), e = e.ownerDocument || e, a = e.createElement("script"), vt(a), Pd(a, "link", r), e.head.appendChild(a), t.instance = a);
			case "void": return null;
			default: throw Error(i(443, t.type));
		}
		else t.type === "stylesheet" && !(t.state.loading & 4) && (r = t.instance, t.state.loading |= 4, Lf(r, n.precedence, e));
		return t.instance;
	}
	function Lf(e, t, n) {
		for (var r = n.querySelectorAll("link[rel=\"stylesheet\"][data-precedence],style[data-precedence]"), i = r.length ? r[r.length - 1] : null, a = i, o = 0; o < r.length; o++) {
			var s = r[o];
			if (s.dataset.precedence === t) a = s;
			else if (a !== i) break;
		}
		a ? a.parentNode.insertBefore(e, a.nextSibling) : (t = n.nodeType === 9 ? n.head : n, t.insertBefore(e, t.firstChild));
	}
	function Rf(e, t) {
		e.crossOrigin ??= t.crossOrigin, e.referrerPolicy ??= t.referrerPolicy, e.title ??= t.title;
	}
	function zf(e, t) {
		e.crossOrigin ??= t.crossOrigin, e.referrerPolicy ??= t.referrerPolicy, e.integrity ??= t.integrity;
	}
	var Bf = null;
	function Vf(e, t, n) {
		if (Bf === null) {
			var r = /* @__PURE__ */ new Map(), i = Bf = /* @__PURE__ */ new Map();
			i.set(n, r);
		} else i = Bf, r = i.get(n), r || (r = /* @__PURE__ */ new Map(), i.set(n, r));
		if (r.has(e)) return r;
		for (r.set(e, null), n = n.getElementsByTagName(e), i = 0; i < n.length; i++) {
			var a = n[i];
			if (!(a[ft] || a[at] || e === "link" && a.getAttribute("rel") === "stylesheet") && a.namespaceURI !== "http://www.w3.org/2000/svg") {
				var o = a.getAttribute(t) || "";
				o = e + o;
				var s = r.get(o);
				s ? s.push(a) : r.set(o, [a]);
			}
		}
		return r;
	}
	function Hf(e, t, n) {
		e = e.ownerDocument || e, e.head.insertBefore(n, t === "title" ? e.querySelector("head > title") : null);
	}
	function Uf(e, t, n) {
		if (n === 1 || t.itemProp != null) return !1;
		switch (e) {
			case "meta":
			case "title": return !0;
			case "style":
				if (typeof t.precedence != "string" || typeof t.href != "string" || t.href === "") break;
				return !0;
			case "link":
				if (typeof t.rel != "string" || typeof t.href != "string" || t.href === "" || t.onLoad || t.onError) break;
				switch (t.rel) {
					case "stylesheet": return e = t.disabled, typeof t.precedence == "string" && e == null;
					default: return !0;
				}
			case "script": if (t.async && typeof t.async != "function" && typeof t.async != "symbol" && !t.onLoad && !t.onError && t.src && typeof t.src == "string") return !0;
		}
		return !1;
	}
	function Wf(e) {
		return !(e.type === "stylesheet" && !(e.state.loading & 3));
	}
	function Gf(e, t, n, r) {
		if (n.type === "stylesheet" && (typeof r.media != "string" || !1 !== matchMedia(r.media).matches) && !(n.state.loading & 4)) {
			if (n.instance === null) {
				var i = Af(r.href), a = t.querySelector(jf(i));
				if (a) {
					t = a._p, typeof t == "object" && t && typeof t.then == "function" && (e.count++, e = Jf.bind(e), t.then(e, e)), n.state.loading |= 4, n.instance = a, vt(a);
					return;
				}
				a = t.ownerDocument || t, r = Mf(r), (i = mf.get(i)) && Rf(r, i), a = a.createElement("link"), vt(a);
				var o = a;
				o._p = new Promise(function(e, t) {
					o.onload = e, o.onerror = t;
				}), Pd(a, "link", r), n.instance = a;
			}
			e.stylesheets === null && (e.stylesheets = /* @__PURE__ */ new Map()), e.stylesheets.set(n, t), (t = n.state.preload) && !(n.state.loading & 3) && (e.count++, n = Jf.bind(e), t.addEventListener("load", n), t.addEventListener("error", n));
		}
	}
	var Kf = 0;
	function qf(e, t) {
		return e.stylesheets && e.count === 0 && Xf(e, e.stylesheets), 0 < e.count || 0 < e.imgCount ? function(n) {
			var r = setTimeout(function() {
				if (e.stylesheets && Xf(e, e.stylesheets), e.unsuspend) {
					var t = e.unsuspend;
					e.unsuspend = null, t();
				}
			}, 6e4 + t);
			0 < e.imgBytes && Kf === 0 && (Kf = 62500 * Ld());
			var i = setTimeout(function() {
				if (e.waitingForImages = !1, e.count === 0 && (e.stylesheets && Xf(e, e.stylesheets), e.unsuspend)) {
					var t = e.unsuspend;
					e.unsuspend = null, t();
				}
			}, (e.imgBytes > Kf ? 50 : 800) + t);
			return e.unsuspend = n, function() {
				e.unsuspend = null, clearTimeout(r), clearTimeout(i);
			};
		} : null;
	}
	function Jf() {
		if (this.count--, this.count === 0 && (this.imgCount === 0 || !this.waitingForImages)) {
			if (this.stylesheets) Xf(this, this.stylesheets);
			else if (this.unsuspend) {
				var e = this.unsuspend;
				this.unsuspend = null, e();
			}
		}
	}
	var Yf = null;
	function Xf(e, t) {
		e.stylesheets = null, e.unsuspend !== null && (e.count++, Yf = /* @__PURE__ */ new Map(), t.forEach(Zf, e), Yf = null, Jf.call(e));
	}
	function Zf(e, t) {
		if (!(t.state.loading & 4)) {
			var n = Yf.get(e);
			if (n) var r = n.get(null);
			else {
				n = /* @__PURE__ */ new Map(), Yf.set(e, n);
				for (var i = e.querySelectorAll("link[data-precedence],style[data-precedence]"), a = 0; a < i.length; a++) {
					var o = i[a];
					(o.nodeName === "LINK" || o.getAttribute("media") !== "not all") && (n.set(o.dataset.precedence, o), r = o);
				}
				r && n.set(null, r);
			}
			i = t.instance, o = i.getAttribute("data-precedence"), a = n.get(o) || r, a === r && n.set(null, i), n.set(o, i), this.count++, r = Jf.bind(this), i.addEventListener("load", r), i.addEventListener("error", r), a ? a.parentNode.insertBefore(i, a.nextSibling) : (e = e.nodeType === 9 ? e.head : e, e.insertBefore(i, e.firstChild)), t.state.loading |= 4;
		}
	}
	var Qf = {
		$$typeof: C,
		Provider: null,
		Consumer: null,
		_currentValue: I,
		_currentValue2: I,
		_threadCount: 0
	};
	function $f(e, t, n, r, i, a, o, s, c) {
		this.tag = 1, this.containerInfo = e, this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = -1, this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null, this.callbackPriority = 0, this.expirationTimes = Je(-1), this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = Je(0), this.hiddenUpdates = Je(null), this.identifierPrefix = r, this.onUncaughtError = i, this.onCaughtError = a, this.onRecoverableError = o, this.pooledCache = null, this.pooledCacheLanes = 0, this.formState = c, this.incompleteTransitions = /* @__PURE__ */ new Map();
	}
	function ep(e, t, n, r, i, a, o, s, c, l, u, d) {
		return e = new $f(e, t, n, o, c, l, u, d, s), t = 1, !0 === a && (t |= 24), a = si(3, null, null, t), e.current = a, a.stateNode = e, t = oa(), t.refCount++, e.pooledCache = t, t.refCount++, a.memoizedState = {
			element: r,
			isDehydrated: n,
			cache: t
		}, za(a), e;
	}
	function tp(e) {
		return e ? (e = ai, e) : ai;
	}
	function np(e, t, n, r, i, a) {
		i = tp(i), r.context === null ? r.context = i : r.pendingContext = i, r = Va(t), r.payload = { element: n }, a = a === void 0 ? null : a, a !== null && (r.callback = a), n = Ha(e, r, t), n !== null && (hu(n, e, t), Ua(n, e, t));
	}
	function rp(e, t) {
		if (e = e.memoizedState, e !== null && e.dehydrated !== null) {
			var n = e.retryLane;
			e.retryLane = n !== 0 && n < t ? n : t;
		}
	}
	function ip(e, t) {
		rp(e, t), (e = e.alternate) && rp(e, t);
	}
	function ap(e) {
		if (e.tag === 13 || e.tag === 31) {
			var t = ni(e, 67108864);
			t !== null && hu(t, e, 67108864), ip(e, 67108864);
		}
	}
	function op(e) {
		if (e.tag === 13 || e.tag === 31) {
			var t = pu();
			t = et(t);
			var n = ni(e, t);
			n !== null && hu(n, e, t), ip(e, t);
		}
	}
	var sp = !0;
	function cp(e, t, n, r) {
		var i = P.T;
		P.T = null;
		var a = F.p;
		try {
			F.p = 2, up(e, t, n, r);
		} finally {
			F.p = a, P.T = i;
		}
	}
	function lp(e, t, n, r) {
		var i = P.T;
		P.T = null;
		var a = F.p;
		try {
			F.p = 8, up(e, t, n, r);
		} finally {
			F.p = a, P.T = i;
		}
	}
	function up(e, t, n, r) {
		if (sp) {
			var i = dp(r);
			if (i === null) wd(e, t, r, fp, n), Cp(e, r);
			else if (Tp(i, e, t, n, r)) r.stopPropagation();
			else if (Cp(e, r), t & 4 && -1 < Sp.indexOf(e)) {
				for (; i !== null;) {
					var a = ht(i);
					if (a !== null) switch (a.tag) {
						case 3:
							if (a = a.stateNode, a.current.memoizedState.isDehydrated) {
								var o = Ue(a.pendingLanes);
								if (o !== 0) {
									var s = a;
									for (s.pendingLanes |= 2, s.entangledLanes |= 2; o;) {
										var c = 1 << 31 - Ie(o);
										s.entanglements[1] |= c, o &= ~c;
									}
									rd(a), !(K & 6) && (tu = we() + 500, id(0, !1));
								}
							}
							break;
						case 31:
						case 13: s = ni(a, 2), s !== null && hu(s, a, 2), bu(), ip(a, 2);
					}
					if (a = dp(r), a === null && wd(e, t, r, fp, n), a === i) break;
					i = a;
				}
				i !== null && r.stopPropagation();
			} else wd(e, t, r, null, n);
		}
	}
	function dp(e) {
		return e = en(e), pp(e);
	}
	var fp = null;
	function pp(e) {
		if (fp = null, e = mt(e), e !== null) {
			var t = o(e);
			if (t === null) e = null;
			else {
				var n = t.tag;
				if (n === 13) {
					if (e = s(t), e !== null) return e;
					e = null;
				} else if (n === 31) {
					if (e = c(t), e !== null) return e;
					e = null;
				} else if (n === 3) {
					if (t.stateNode.current.memoizedState.isDehydrated) return t.tag === 3 ? t.stateNode.containerInfo : null;
					e = null;
				} else t !== e && (e = null);
			}
		}
		return fp = e, null;
	}
	function mp(e) {
		switch (e) {
			case "beforetoggle":
			case "cancel":
			case "click":
			case "close":
			case "contextmenu":
			case "copy":
			case "cut":
			case "auxclick":
			case "dblclick":
			case "dragend":
			case "dragstart":
			case "drop":
			case "focusin":
			case "focusout":
			case "input":
			case "invalid":
			case "keydown":
			case "keypress":
			case "keyup":
			case "mousedown":
			case "mouseup":
			case "paste":
			case "pause":
			case "play":
			case "pointercancel":
			case "pointerdown":
			case "pointerup":
			case "ratechange":
			case "reset":
			case "resize":
			case "seeked":
			case "submit":
			case "toggle":
			case "touchcancel":
			case "touchend":
			case "touchstart":
			case "volumechange":
			case "change":
			case "selectionchange":
			case "textInput":
			case "compositionstart":
			case "compositionend":
			case "compositionupdate":
			case "beforeblur":
			case "afterblur":
			case "beforeinput":
			case "blur":
			case "fullscreenchange":
			case "focus":
			case "hashchange":
			case "popstate":
			case "select":
			case "selectstart": return 2;
			case "drag":
			case "dragenter":
			case "dragexit":
			case "dragleave":
			case "dragover":
			case "mousemove":
			case "mouseout":
			case "mouseover":
			case "pointermove":
			case "pointerout":
			case "pointerover":
			case "scroll":
			case "touchmove":
			case "wheel":
			case "mouseenter":
			case "mouseleave":
			case "pointerenter":
			case "pointerleave": return 8;
			case "message": switch (Te()) {
				case Ee: return 2;
				case De: return 8;
				case Oe:
				case ke: return 32;
				case Ae: return 268435456;
				default: return 32;
			}
			default: return 32;
		}
	}
	var hp = !1, gp = null, _p = null, vp = null, yp = /* @__PURE__ */ new Map(), bp = /* @__PURE__ */ new Map(), xp = [], Sp = "mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset".split(" ");
	function Cp(e, t) {
		switch (e) {
			case "focusin":
			case "focusout":
				gp = null;
				break;
			case "dragenter":
			case "dragleave":
				_p = null;
				break;
			case "mouseover":
			case "mouseout":
				vp = null;
				break;
			case "pointerover":
			case "pointerout":
				yp.delete(t.pointerId);
				break;
			case "gotpointercapture":
			case "lostpointercapture": bp.delete(t.pointerId);
		}
	}
	function wp(e, t, n, r, i, a) {
		return e === null || e.nativeEvent !== a ? (e = {
			blockedOn: t,
			domEventName: n,
			eventSystemFlags: r,
			nativeEvent: a,
			targetContainers: [i]
		}, t !== null && (t = ht(t), t !== null && ap(t)), e) : (e.eventSystemFlags |= r, t = e.targetContainers, i !== null && t.indexOf(i) === -1 && t.push(i), e);
	}
	function Tp(e, t, n, r, i) {
		switch (t) {
			case "focusin": return gp = wp(gp, e, t, n, r, i), !0;
			case "dragenter": return _p = wp(_p, e, t, n, r, i), !0;
			case "mouseover": return vp = wp(vp, e, t, n, r, i), !0;
			case "pointerover":
				var a = i.pointerId;
				return yp.set(a, wp(yp.get(a) || null, e, t, n, r, i)), !0;
			case "gotpointercapture": return a = i.pointerId, bp.set(a, wp(bp.get(a) || null, e, t, n, r, i)), !0;
		}
		return !1;
	}
	function Ep(e) {
		var t = mt(e.target);
		if (t !== null) {
			var n = o(t);
			if (n !== null) {
				if (t = n.tag, t === 13) {
					if (t = s(n), t !== null) {
						e.blockedOn = t, rt(e.priority, function() {
							op(n);
						});
						return;
					}
				} else if (t === 31) {
					if (t = c(n), t !== null) {
						e.blockedOn = t, rt(e.priority, function() {
							op(n);
						});
						return;
					}
				} else if (t === 3 && n.stateNode.current.memoizedState.isDehydrated) {
					e.blockedOn = n.tag === 3 ? n.stateNode.containerInfo : null;
					return;
				}
			}
		}
		e.blockedOn = null;
	}
	function Dp(e) {
		if (e.blockedOn !== null) return !1;
		for (var t = e.targetContainers; 0 < t.length;) {
			var n = dp(e.nativeEvent);
			if (n === null) {
				n = e.nativeEvent;
				var r = new n.constructor(n.type, n);
				$t = r, n.target.dispatchEvent(r), $t = null;
			} else return t = ht(n), t !== null && ap(t), e.blockedOn = n, !1;
			t.shift();
		}
		return !0;
	}
	function Op(e, t, n) {
		Dp(e) && n.delete(t);
	}
	function kp() {
		hp = !1, gp !== null && Dp(gp) && (gp = null), _p !== null && Dp(_p) && (_p = null), vp !== null && Dp(vp) && (vp = null), yp.forEach(Op), bp.forEach(Op);
	}
	function Ap(e, n) {
		e.blockedOn === n && (e.blockedOn = null, hp || (hp = !0, t.unstable_scheduleCallback(t.unstable_NormalPriority, kp)));
	}
	var jp = null;
	function Mp(e) {
		jp !== e && (jp = e, t.unstable_scheduleCallback(t.unstable_NormalPriority, function() {
			jp === e && (jp = null);
			for (var t = 0; t < e.length; t += 3) {
				var n = e[t], r = e[t + 1], i = e[t + 2];
				if (typeof r != "function") {
					if (pp(r || n) === null) continue;
					break;
				}
				var a = ht(n);
				a !== null && (e.splice(t, 3), t -= 3, ws(a, {
					pending: !0,
					data: i,
					method: n.method,
					action: r
				}, r, i));
			}
		}));
	}
	function Np(e) {
		function t(t) {
			return Ap(t, e);
		}
		gp !== null && Ap(gp, e), _p !== null && Ap(_p, e), vp !== null && Ap(vp, e), yp.forEach(t), bp.forEach(t);
		for (var n = 0; n < xp.length; n++) {
			var r = xp[n];
			r.blockedOn === e && (r.blockedOn = null);
		}
		for (; 0 < xp.length && (n = xp[0], n.blockedOn === null);) Ep(n), n.blockedOn === null && xp.shift();
		if (n = (e.ownerDocument || e).$$reactFormReplay, n != null) for (r = 0; r < n.length; r += 3) {
			var i = n[r], a = n[r + 1], o = i[ot] || null;
			if (typeof a == "function") o || Mp(n);
			else if (o) {
				var s = null;
				if (a && a.hasAttribute("formAction")) {
					if (i = a, o = a[ot] || null) s = o.formAction;
					else if (pp(i) !== null) continue;
				} else s = o.action;
				typeof s == "function" ? n[r + 1] = s : (n.splice(r, 3), r -= 3), Mp(n);
			}
		}
	}
	function Pp() {
		function e(e) {
			e.canIntercept && e.info === "react-transition" && e.intercept({
				handler: function() {
					return new Promise(function(e) {
						return i = e;
					});
				},
				focusReset: "manual",
				scroll: "manual"
			});
		}
		function t() {
			i !== null && (i(), i = null), r || setTimeout(n, 20);
		}
		function n() {
			if (!r && !navigation.transition) {
				var e = navigation.currentEntry;
				e && e.url != null && navigation.navigate(e.url, {
					state: e.getState(),
					info: "react-transition",
					history: "replace"
				});
			}
		}
		if (typeof navigation == "object") {
			var r = !1, i = null;
			return navigation.addEventListener("navigate", e), navigation.addEventListener("navigatesuccess", t), navigation.addEventListener("navigateerror", t), setTimeout(n, 100), function() {
				r = !0, navigation.removeEventListener("navigate", e), navigation.removeEventListener("navigatesuccess", t), navigation.removeEventListener("navigateerror", t), i !== null && (i(), i = null);
			};
		}
	}
	function Fp(e) {
		this._internalRoot = e;
	}
	Ip.prototype.render = Fp.prototype.render = function(e) {
		var t = this._internalRoot;
		if (t === null) throw Error(i(409));
		var n = t.current;
		np(n, pu(), e, t, null, null);
	}, Ip.prototype.unmount = Fp.prototype.unmount = function() {
		var e = this._internalRoot;
		if (e !== null) {
			this._internalRoot = null;
			var t = e.containerInfo;
			np(e.current, 2, null, e, null, null), bu(), t[st] = null;
		}
	};
	function Ip(e) {
		this._internalRoot = e;
	}
	Ip.prototype.unstable_scheduleHydration = function(e) {
		if (e) {
			var t = nt();
			e = {
				blockedOn: null,
				target: e,
				priority: t
			};
			for (var n = 0; n < xp.length && t !== 0 && t < xp[n].priority; n++);
			xp.splice(n, 0, e), n === 0 && Ep(e);
		}
	};
	var Lp = n.version;
	if (Lp !== "19.2.7") throw Error(i(527, Lp, "19.2.7"));
	F.findDOMNode = function(e) {
		var t = e._reactInternals;
		if (t === void 0) throw typeof e.render == "function" ? Error(i(188)) : (e = Object.keys(e).join(","), Error(i(268, e)));
		return e = d(t), e = e === null ? null : p(e), e = e === null ? null : e.stateNode, e;
	};
	var Rp = {
		bundleType: 0,
		version: "19.2.7",
		rendererPackageName: "react-dom",
		currentDispatcherRef: P,
		reconcilerVersion: "19.2.7"
	};
	if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u") {
		var zp = __REACT_DEVTOOLS_GLOBAL_HOOK__;
		if (!zp.isDisabled && zp.supportsFiber) try {
			Ne = zp.inject(Rp), Pe = zp;
		} catch {}
	}
	e.createRoot = function(e, t) {
		if (!a(e)) throw Error(i(299));
		var n = !1, r = "", o = qs, s = Js, c = Ys;
		return t != null && (!0 === t.unstable_strictMode && (n = !0), t.identifierPrefix !== void 0 && (r = t.identifierPrefix), t.onUncaughtError !== void 0 && (o = t.onUncaughtError), t.onCaughtError !== void 0 && (s = t.onCaughtError), t.onRecoverableError !== void 0 && (c = t.onRecoverableError)), t = ep(e, 1, !1, null, null, n, r, null, o, s, c, Pp), e[st] = t.current, Sd(e), new Fp(t);
	};
})), g = /* @__PURE__ */ o(((e, t) => {
	function n() {
		if (!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u" || typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE != "function")) try {
			__REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(n);
		} catch (e) {
			console.error(e);
		}
	}
	n(), t.exports = h();
})), _ = /* @__PURE__ */ o(((e) => {
	var t = Symbol.for("react.transitional.element"), n = Symbol.for("react.fragment");
	function r(e, n, r) {
		var i = null;
		if (r !== void 0 && (i = "" + r), n.key !== void 0 && (i = "" + n.key), "key" in n) for (var a in r = {}, n) a !== "key" && (r[a] = n[a]);
		else r = n;
		return n = r.ref, {
			$$typeof: t,
			type: e,
			key: i,
			ref: n === void 0 ? null : n,
			props: r
		};
	}
	e.Fragment = n, e.jsx = r, e.jsxs = r;
})), v = /* @__PURE__ */ o(((e, t) => {
	t.exports = _();
})), y = g(), b = /* @__PURE__ */ c(u(), 1), x = v(), S = [
	{
		id: "connections",
		label: "חיבורים"
	},
	{
		id: "agents",
		label: "סוכני AI"
	},
	{
		id: "retrieval",
		label: "שליפה ו-RAG"
	},
	{
		id: "content",
		label: "APP DATA"
	},
	{
		id: "tools",
		label: "כלים n8n"
	},
	{
		id: "performance",
		label: "ביצועים ו-Cache"
	},
	{
		id: "presets",
		label: "פריסטים"
	},
	{
		id: "general",
		label: "כללי"
	}
], C = [
	{
		key: "classifier",
		label: "Classifier",
		desc: "ניתוב וסיווג השאלה",
		promptRows: 9
	},
	{
		key: "knowledgePlanner",
		label: "Knowledge Planner",
		desc: "תכנון חיפוש ידע מקומי",
		promptRows: 9
	},
	{
		key: "main",
		label: "Main",
		desc: "תשובת הצ׳אט הראשית",
		promptRows: 12,
		wide: !0
	},
	{
		key: "lite",
		label: "Lite",
		desc: "משימות קצרות ועזר",
		promptRows: 7
	},
	{
		key: "reranker",
		label: "Reranker",
		desc: "דירוג מקורות לפני תשובה",
		promptRows: 9
	},
	{
		key: "qa",
		label: "QA Report",
		desc: "ניתוח איכות ריצה",
		promptRows: 9
	}
], w = {
	temperature: "קובע כמה התשובה תהיה יצירתית או צפויה. ערך נמוך נותן תשובות יציבות ומדויקות יותר; ערך גבוה נותן ניסוח מגוון יותר.",
	maxTokens: "מגביל את אורך התשובה שהמודל יכול לייצר. ערך גבוה מאפשר תשובה מפורטת יותר, אבל יכול לעלות יותר ולקחת יותר זמן.",
	timeoutMs: "כמה זמן המערכת תחכה לתשובת המודל לפני שהיא מחשיבה את הקריאה כתקועה. נמדד במילישניות.",
	embeddingModel: "המודל שיוצר את הווקטורים (embeddings) של הטקסט לצורך חיפוש סמנטי. חייב להתאים למודל שבו נוצר האינדקס ב-Supabase.",
	hybridRpcName: "שם פונקציית ה-RPC ב-Supabase שמריצה את החיפוש ההיברידי (וקטורי + מילולי). חייב להתאים לפונקציה שקיימת במסד.",
	hybridCandidates: "כמה שורות כל חיפוש היברידי ראשי יבקש מ-Supabase. ערך גבוה מגדיל כיסוי, אך מוסיף זמן, עומס ועלות דירוג.",
	plannerCandidates: "כמה שורות תוחזרנה מכל שאילתת חיפוש נוספת שה-Knowledge Planner יוצר. הכמות הכוללת יכולה להיות מספר השאילתות כפול ערך זה.",
	alertCandidates: "כמה התראות סוכן Alerts יבקש מפונקציית החיפוש לפני סינון תאריכים וסיכום התוצאה.",
	rerankTopK: "כמה מהשורות שנמצאו יישארו לאחר דירוג הרלוונטיות. רק התוצאות המדורגות ביותר ממשיכות לשלבים הבאים.",
	vectorWeight: "משקל החיפוש הסמנטי (וקטורי) בציון ההיברידי. ביחד עם משקל המילים הוא קובע איזה סוג התאמה חשוב יותר. בדרך כלל מסתכם ל-1 עם משקל המילים.",
	keywordWeight: "משקל החיפוש המילולי (מילות מפתח) בציון ההיברידי. ערך גבוה מחזק התאמות טקסטואליות מדויקות על פני התאמה משמעותית.",
	ragContextRecordsLimit: "כמה מקורות אחרי החיפוש והדירוג ייכנסו בפועל לסוכן הראשי. יותר מקורות נותנים כיסוי רחב יותר אבל עלולים להעמיס.",
	ragChunkTextLimit: "כמה תווים מכל מקור ייכנסו לפרומפט. ערך גבוה נותן יותר הקשר מכל מקור, אבל מגדיל עלות וזמן.",
	ragPlannerExtraQueriesLimit: "כמה שאילתות נוספות Knowledge Planner רשאי להריץ מעבר לשאלה המקורית.",
	graphLimit: "כמה קשרים מהגרף ייכנסו בפועל לתשובת הצ׳אט. ערך 0 מכבה את שילוב הגרף.",
	graphDaysBack: "כמה ימים אחורה לחפש קשרים בגרף הפרויקט סביב תוצאות ה-RAG.",
	timelineLimit: "מספר השורות המקסימלי שיימשכו עבור ציר הזמן. ערך גבוה מציג היסטוריה מלאה יותר אבל כבד יותר לטעינה.",
	timelineDaysBack: "כמה ימים אחורה לכלול באירועי ציר הזמן. מגביל את חלון הזמן הנשלף מהמסד.",
	graphSearchLimit: "כמה קשרים/צמתים לחפש בגרף סביב תוצאות ה-RAG.",
	graphContextLimit: "כמה קשרים מהגרף ייכנסו בפועל לתשובת הצ׳אט.",
	graphEnabled: "כאשר פעיל, הצ׳אט משתמש בגרף הפרויקט כדי לזהות קשרים בין אירועים, ספקים, נושאים וסיכונים.",
	graphExpandedForListQuestions: "בשאלות כמו 'מי', 'מה עוד', או 'רשימה', מאפשר להכניס יותר קשרי גרף כדי לא לפספס מועמדים.",
	knowledgeAgentLimit: "כמה סוכני Knowledge Base מקומיים אפשר לבחור לשאלה אחת.",
	knowledgeTopK: "כמה קטעי ידע מקומי יוחזרו מכל סוכן ידע שנבחר.",
	knowledgeChunkSize: "האורך המקסימלי של כל קטע ידע מקומי שנכנס לתכנון החיפוש.",
	toolsParallelLimit: "כמה כלי N8N אפשר להריץ במקביל באותה שאלה.",
	toolsEnabled: "כאשר כבוי, הצ׳אט לא יקרא לכלי N8N חיצוניים, אבל RAG ו-Graph עדיין יכולים לעבוד.",
	toolsAlertAgentEnabled: "כאשר פעיל, סוכן ההתראות יכול למשוך ולסכם נתונים מטבלת alerts.",
	toolsSafetyPrecheckEnabled: "כאשר פעיל, שאלות דחופות או בטיחותיות מפעילות בדיקה מוקדמת לפני שאר הכלים.",
	alertTemperature: "קובע כמה התשובה של סוכן ההתראות תהיה יציבה. ערך נמוך נותן ניתוח עקבי יותר.",
	alertMaxTokens: "מגביל את אורך התשובה של סוכן ההתראות.",
	alertTimeoutMs: "כמה זמן לחכות לתשובת סוכן ההתראות לפני שמחשיבים את הקריאה כתקועה. נמדד במילישניות.",
	cacheEnabled: "כאשר פעיל, תשובות ותוצאות חיפוש נשמרות זמנית כדי להאיץ שאלות חוזרות ולהפחית עלות.",
	cacheProvider: "היכן לשמור את ה-cache: Memory לפיתוח (נמחק בכל הפעלה), Redis ל-Production, או ללא cache.",
	cacheRedisUrl: "כתובת חיבור ל-Redis כאשר נבחר provider מסוג Redis. נשמר כסוד — השאר ריק כדי לשמור את הערך הקיים.",
	cacheMemoryMaxEntries: "מספר הרשומות המקסימלי שיישמרו ב-cache מסוג Memory לפני שהישנות נמחקות."
}, T = /* @__PURE__ */ "UTC-12.UTC-11.UTC-10.UTC-9.UTC-8.UTC-7.UTC-6.UTC-5.UTC-4.UTC-3.UTC-2.UTC-1.UTC+0 (Greenwich).UTC+1.UTC+2.Asia/Jerusalem.UTC+3.UTC+4.UTC+5.UTC+5:30 (הודו).UTC+6.UTC+7.UTC+8.UTC+9.UTC+10.UTC+11.UTC+12".split(".");
async function E(e, t = {}) {
	let n = await fetch(e, {
		headers: { "Content-Type": "application/json" },
		...t,
		body: t.body ? JSON.stringify(t.body) : void 0
	});
	if (!n.ok) throw Error(`HTTP ${n.status}`);
	return n.json();
}
function ee(e, t, n) {
	let r = t.split("."), i = { ...e }, a = i;
	for (let e = 0; e < r.length - 1; e++) a[r[e]] = { ...a[r[e]] }, a = a[r[e]];
	return a[r[r.length - 1]] = n, i;
}
function D(e) {
	return e ? {
		models: { ...e.models },
		prompts: { ...e.prompts },
		ai: e.ai ? JSON.parse(JSON.stringify(e.ai)) : {},
		retrieval: { ...e.retrieval },
		rag: { ...e.rag },
		graph: { ...e.graph },
		cache: {
			...e.cache,
			redisUrl: ""
		},
		knowledge: {
			...e.knowledge,
			triggerKeywords: (e.knowledge?.triggerKeywords || []).join("\n")
		},
		toolsRuntime: { ...e.toolsRuntime },
		secrets: {
			openRouterApiKey: "",
			supabaseUrl: e.secrets?.supabaseUrl || "",
			supabaseServiceRoleKey: ""
		},
		contentSource: {
			...e.contentSource,
			useAppSupabase: e.contentSource?.usesAppSupabase === !0,
			supabaseServiceRoleKey: ""
		},
		n8nBaseUrl: e.n8nBaseUrl || "",
		tools: e.tools ? Object.fromEntries(Object.entries(e.tools).map(([e, t]) => [e, t?.url || ""])) : {},
		timezone: e.timezone || "Asia/Jerusalem",
		presets: e.presets || []
	} : {};
}
function te(e) {
	return {
		models: e.models,
		prompts: e.prompts,
		ai: e.ai,
		retrieval: e.retrieval,
		rag: e.rag,
		graph: e.graph,
		cache: e.cache,
		knowledge: {
			...e.knowledge,
			triggerKeywords: (e.knowledge?.triggerKeywords || "").split("\n").map((e) => e.trim()).filter(Boolean)
		},
		toolsRuntime: e.toolsRuntime,
		secrets: e.secrets,
		contentSource: e.contentSource,
		n8nBaseUrl: e.n8nBaseUrl,
		tools: Object.fromEntries(Object.entries(e.tools || {}).map(([e, t]) => [e, { url: t }])),
		timezone: e.timezone
	};
}
var O = ({ path: e, size: t = 16, ...n }) => /* @__PURE__ */ (0, x.jsx)("svg", {
	width: t,
	height: t,
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: "1.8",
	strokeLinecap: "round",
	strokeLinejoin: "round",
	...n,
	children: /* @__PURE__ */ (0, x.jsx)("path", { d: e })
}), k = {
	info: "M12 22C6.5 22 2 17.5 2 12S6.5 2 12 2s10 4.5 10 10-4.5 10-10 10zm0-11v5m0-8h.01",
	connections: "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
	agents: "M12 2a5 5 0 1 0 0 10A5 5 0 0 0 12 2zM3.5 22a8.5 8.5 0 0 1 17 0",
	retrieval: "M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z",
	content: "M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7zm0 5h16M8 3v4M16 3v4",
	tools: "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3-3a1 1 0 0 0 0-1.4L19 3.3a1 1 0 0 0-1.4 0zM5 17l-1 4 4-1L20 8l-3-3zM16 5l3 3",
	presets: "M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2zM17 21v-8H7v8M7 3v5h8",
	performance: "M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm1.5-1.5L18 8M5 19a9 9 0 1 1 14 0",
	general: "M12 22C6.5 22 2 17.5 2 12S6.5 2 12 2s10 4.5 10 10-4.5 10-10 10zm0-14v4l3 3",
	save: "M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2zM17 21v-8H7v8M7 3v5h8",
	reload: "M23 4v6h-6M1 20v-6h6M3.5 9a9 9 0 0 1 14.8-3.5L23 10M1 14l4.7 4.5A9 9 0 0 0 20.5 15",
	upload: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12",
	download: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
	eye: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
	eyeOff: "M17.9 17.4A10 10 0 0 1 12 20c-7 0-11-8-11-8a18.5 18.5 0 0 1 5.1-5.9M9.9 4.2A9 9 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.2 3.2M1 1l22 22",
	check: "M20 6L9 17l-5-5",
	warning: "M10.3 3.3L1.5 18A2 2 0 0 0 3.2 21h17.6a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01",
	chevronDown: "M6 9l6 6 6-6",
	plus: "M12 5v14M5 12h14"
}, A = {
	label: {
		display: "flex",
		flexDirection: "column",
		gap: 5,
		fontSize: 13,
		fontWeight: 500,
		color: "var(--text-primary)"
	},
	input: {
		padding: "7px 10px",
		borderRadius: "var(--r)",
		border: "1px solid var(--line-strong)",
		background: "var(--surface-2)",
		color: "var(--text-primary)",
		fontSize: 13,
		fontFamily: "var(--font-display)",
		width: "100%",
		boxSizing: "border-box",
		transition: "border-color .15s",
		outline: "none"
	},
	hint: {
		fontSize: 12,
		color: "var(--text-muted)",
		lineHeight: 1.5,
		margin: 0
	},
	card: {
		background: "var(--surface)",
		border: "1px solid var(--line)",
		borderRadius: "var(--r-xl)",
		padding: "18px 20px",
		boxShadow: "0 1px 4px rgba(0,0,0,.04)"
	},
	section: {
		display: "flex",
		flexDirection: "column",
		gap: 20
	},
	grid2: {
		display: "grid",
		gridTemplateColumns: "1fr 1fr",
		gap: 14
	},
	grid3: {
		display: "grid",
		gridTemplateColumns: "1fr 1fr 1fr",
		gap: 10
	},
	sectionTitle: {
		fontSize: 13,
		fontWeight: 700,
		color: "var(--text-muted)",
		letterSpacing: .6,
		textTransform: "uppercase",
		margin: "4px 0 10px"
	}
};
function j({ label: e, hint: t, info: n, children: r, wide: i }) {
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		style: {
			...i ? { gridColumn: "1 / -1" } : {},
			...A.label
		},
		children: [
			e && /* @__PURE__ */ (0, x.jsxs)("span", {
				style: {
					display: "inline-flex",
					alignItems: "center",
					gap: 6,
					minWidth: 0
				},
				children: [/* @__PURE__ */ (0, x.jsx)("span", {
					style: {
						overflow: "hidden",
						textOverflow: "ellipsis"
					},
					children: e
				}), n && /* @__PURE__ */ (0, x.jsx)(M, {
					text: n,
					label: e
				})]
			}),
			r,
			t && /* @__PURE__ */ (0, x.jsx)("p", {
				style: A.hint,
				children: t
			})
		]
	});
}
function M({ text: e, label: t }) {
	let [n, r] = (0, b.useState)(!1), [i, a] = (0, b.useState)(!1), o = (0, b.useRef)(null), s = n || i;
	return (0, b.useEffect)(() => {
		if (!n) return;
		let e = (e) => {
			o.current && !o.current.contains(e.target) && r(!1);
		}, t = (e) => {
			e.key === "Escape" && r(!1);
		};
		return document.addEventListener("mousedown", e), document.addEventListener("keydown", t), () => {
			document.removeEventListener("mousedown", e), document.removeEventListener("keydown", t);
		};
	}, [n]), /* @__PURE__ */ (0, x.jsxs)("span", {
		ref: o,
		style: {
			position: "relative",
			display: "inline-flex"
		},
		children: [/* @__PURE__ */ (0, x.jsx)("button", {
			type: "button",
			onClick: (e) => {
				e.preventDefault(), r((e) => !e);
			},
			onMouseEnter: () => a(!0),
			onMouseLeave: () => a(!1),
			"aria-label": `מידע על ${typeof t == "string" ? t : "השדה"}`,
			"aria-expanded": n,
			style: {
				width: 16,
				height: 16,
				minHeight: 16,
				minWidth: 16,
				flex: "0 0 auto",
				display: "inline-grid",
				placeItems: "center",
				padding: 0,
				margin: 0,
				lineHeight: 0,
				borderRadius: "999px",
				border: "none",
				background: "none",
				color: s ? "var(--brand-500)" : "var(--text-muted)",
				cursor: "pointer",
				transition: "color .15s, transform .15s",
				transform: s ? "scale(1.08)" : "scale(1)"
			},
			children: /* @__PURE__ */ (0, x.jsx)(O, {
				path: k.info,
				size: 15,
				strokeWidth: 1.9
			})
		}), n && /* @__PURE__ */ (0, x.jsxs)("span", {
			role: "tooltip",
			style: {
				position: "absolute",
				top: "calc(100% + 9px)",
				insetInlineEnd: -4,
				zIndex: 50,
				width: 264,
				maxWidth: 300,
				background: "var(--surface)",
				color: "var(--text-secondary)",
				border: "1px solid var(--line-strong)",
				borderRadius: "var(--r-lg, 12px)",
				boxShadow: "0 10px 30px rgba(15, 23, 42, .18)",
				padding: "11px 13px",
				fontSize: 12.5,
				fontWeight: 500,
				lineHeight: 1.6,
				textAlign: "right",
				fontStyle: "normal",
				whiteSpace: "normal",
				cursor: "default",
				animation: "bidocFade .12s ease-out"
			},
			onClick: (e) => e.stopPropagation(),
			children: [/* @__PURE__ */ (0, x.jsx)("span", { style: {
				position: "absolute",
				top: -6,
				insetInlineEnd: 8,
				width: 11,
				height: 11,
				background: "var(--surface)",
				borderTop: "1px solid var(--line-strong)",
				borderInlineStart: "1px solid var(--line-strong)",
				transform: "rotate(45deg)"
			} }), e]
		})]
	});
}
function N({ children: e }) {
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		style: {
			display: "flex",
			alignItems: "flex-start",
			gap: 7,
			color: "var(--text-muted)",
			fontSize: 12.5,
			lineHeight: 1.55,
			background: "var(--surface-2)",
			border: "1px solid var(--line)",
			borderRadius: "var(--r)",
			padding: "8px 12px",
			marginTop: 2
		},
		children: [/* @__PURE__ */ (0, x.jsx)(O, {
			path: k.info,
			size: 14,
			style: {
				flexShrink: 0,
				marginTop: 1,
				color: "var(--brand-500)"
			}
		}), /* @__PURE__ */ (0, x.jsx)("span", { children: e })]
	});
}
var P = "0 0 0 3px rgba(63, 141, 104, .16)";
function F({ value: e, onChange: t, type: n = "text", placeholder: r, min: i, max: a, step: o, style: s, name: c, autoComplete: l, spellCheck: u, autoCapitalize: d, ...f }) {
	let [p, m] = (0, b.useState)(!1);
	return /* @__PURE__ */ (0, x.jsx)("input", {
		type: n,
		value: e ?? "",
		placeholder: r,
		min: i,
		max: a,
		step: o,
		name: c,
		autoComplete: l,
		spellCheck: u,
		autoCapitalize: d,
		...f,
		onChange: (e) => t(n === "number" ? Number(e.target.value) : e.target.value),
		onFocus: () => m(!0),
		onBlur: () => m(!1),
		style: {
			...A.input,
			borderColor: p ? "var(--brand-500)" : void 0,
			boxShadow: p ? P : "none",
			...s
		}
	});
}
function I({ value: e, onChange: t, children: n, style: r }) {
	let [i, a] = (0, b.useState)(!1);
	return /* @__PURE__ */ (0, x.jsx)("select", {
		value: e ?? "",
		onChange: (e) => t(e.target.value),
		onFocus: () => a(!0),
		onBlur: () => a(!1),
		style: {
			...A.input,
			cursor: "pointer",
			borderColor: i ? "var(--brand-500)" : void 0,
			boxShadow: i ? P : "none",
			...r
		},
		children: n
	});
}
function ne({ label: e, checked: t, onChange: n, info: r }) {
	return /* @__PURE__ */ (0, x.jsxs)("label", {
		style: {
			display: "flex",
			alignItems: "center",
			gap: 10,
			cursor: "pointer",
			fontSize: 13,
			fontWeight: 500,
			color: "var(--text-primary)"
		},
		children: [/* @__PURE__ */ (0, x.jsx)("button", {
			type: "button",
			role: "switch",
			"aria-checked": !!t,
			onClick: () => n(!t),
			style: {
				position: "relative",
				width: 36,
				height: 20,
				minHeight: 20,
				minWidth: 36,
				flexShrink: 0,
				borderRadius: 999,
				border: "none",
				cursor: "pointer",
				padding: 0,
				margin: 0,
				background: t ? "var(--brand-500)" : "var(--line-strong)",
				transition: "background .18s"
			},
			children: /* @__PURE__ */ (0, x.jsx)("span", { style: {
				position: "absolute",
				top: 2,
				left: t ? 18 : 2,
				width: 16,
				height: 16,
				borderRadius: "50%",
				background: "#fff",
				transition: "left .18s cubic-bezier(.4,0,.2,1)",
				boxShadow: "0 1px 2px rgba(0,0,0,.28)"
			} })
		}), /* @__PURE__ */ (0, x.jsxs)("span", {
			style: {
				display: "inline-flex",
				alignItems: "center",
				gap: 6
			},
			children: [e, r && /* @__PURE__ */ (0, x.jsx)(M, {
				text: r,
				label: e
			})]
		})]
	});
}
function re({ value: e, onChange: t, rows: n = 6, placeholder: r }) {
	let [i, a] = (0, b.useState)(!1);
	return /* @__PURE__ */ (0, x.jsx)("textarea", {
		value: e ?? "",
		rows: n,
		placeholder: r,
		onChange: (e) => t(e.target.value),
		onFocus: () => a(!0),
		onBlur: () => a(!1),
		spellCheck: !1,
		style: {
			...A.input,
			resize: "vertical",
			lineHeight: 1.5,
			borderColor: i ? "var(--brand-500)" : void 0,
			boxShadow: i ? P : "none"
		}
	});
}
function ie({ label: e, value: t, onChange: n, placeholder: r, hint: i, info: a, disabled: o = !1 }) {
	let [s, c] = (0, b.useState)(!1);
	return /* @__PURE__ */ (0, x.jsx)(j, {
		label: e,
		hint: i,
		info: a,
		children: /* @__PURE__ */ (0, x.jsxs)("div", {
			style: { position: "relative" },
			children: [/* @__PURE__ */ (0, x.jsx)(F, {
				type: "text",
				value: t,
				onChange: n,
				name: `bidoc-secret-${String(e).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
				autoComplete: "off",
				spellCheck: !1,
				autoCapitalize: "none",
				"data-1p-ignore": "true",
				"data-lpignore": "true",
				"data-bwignore": "true",
				"aria-autocomplete": "none",
				disabled: o,
				placeholder: r,
				style: {
					paddingLeft: 36,
					WebkitTextSecurity: s ? "none" : "disc"
				}
			}), /* @__PURE__ */ (0, x.jsx)("button", {
				type: "button",
				onClick: () => c((e) => !e),
				style: {
					position: "absolute",
					left: 8,
					top: "50%",
					transform: "translateY(-50%)",
					background: "none",
					border: "none",
					cursor: "pointer",
					color: "var(--text-muted)",
					padding: 2
				},
				title: s ? "הסתר" : "הצג",
				children: /* @__PURE__ */ (0, x.jsx)(O, {
					path: s ? k.eyeOff : k.eye,
					size: 15
				})
			})]
		})
	});
}
function L({ title: e, children: t, defaultOpen: n = !1 }) {
	let [r, i] = (0, b.useState)(n);
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		style: {
			borderTop: "1px solid var(--line)",
			marginTop: 4
		},
		children: [/* @__PURE__ */ (0, x.jsxs)("button", {
			onClick: () => i((e) => !e),
			style: {
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
				width: "100%",
				padding: "8px 0",
				background: "none",
				border: "none",
				cursor: "pointer",
				color: "var(--text-secondary)",
				fontSize: 12.5,
				fontWeight: 500,
				fontFamily: "var(--font-display)"
			},
			children: [e, /* @__PURE__ */ (0, x.jsx)(O, {
				path: k.chevronDown,
				size: 14,
				style: {
					transform: r ? "rotate(180deg)" : "none",
					transition: "transform .2s"
				}
			})]
		}), r && /* @__PURE__ */ (0, x.jsx)("div", {
			style: { paddingBottom: 12 },
			children: t
		})]
	});
}
function R({ ok: e }) {
	return /* @__PURE__ */ (0, x.jsx)("span", {
		style: {
			display: "inline-block",
			width: 8,
			height: 8,
			borderRadius: "50%",
			flexShrink: 0,
			background: e ? "var(--brand-500)" : "var(--text-muted)",
			boxShadow: e ? "0 0 0 3px rgba(63,141,104,.15)" : "none"
		},
		title: e ? "מוגדר" : "לא מוגדר"
	});
}
function ae({ value: e, onChange: t, models: n, includeEmbedding: r = !1 }) {
	return /* @__PURE__ */ (0, x.jsxs)(I, {
		value: e,
		onChange: t,
		children: [/* @__PURE__ */ (0, x.jsx)("option", {
			value: "",
			children: "— ברירת מחדל —"
		}), n.map((e) => /* @__PURE__ */ (0, x.jsxs)("option", {
			value: e.id,
			children: [e.name || e.id, e.contextLength ? ` · ${Number(e.contextLength).toLocaleString()}` : ""]
		}, e.id))]
	});
}
function oe({ form: e, update: t, configStatus: n }) {
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		style: A.section,
		children: [
			/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("p", {
				style: A.sectionTitle,
				children: "OpenRouter"
			}), /* @__PURE__ */ (0, x.jsxs)("div", {
				style: A.card,
				children: [/* @__PURE__ */ (0, x.jsxs)("div", {
					style: {
						display: "flex",
						alignItems: "center",
						gap: 8,
						marginBottom: 14
					},
					children: [/* @__PURE__ */ (0, x.jsx)(R, { ok: n?.openRouter }), /* @__PURE__ */ (0, x.jsx)("span", {
						style: {
							fontSize: 12.5,
							color: "var(--text-secondary)"
						},
						children: n?.openRouter ? "OpenRouter מוגדר" : "OpenRouter לא מוגדר"
					})]
				}), /* @__PURE__ */ (0, x.jsx)(ie, {
					label: "OpenRouter API Key",
					value: e.secrets?.openRouterApiKey,
					onChange: (e) => t("secrets.openRouterApiKey", e),
					placeholder: "sk-or-...",
					hint: "השאר ריק כדי לשמור את הערך הקיים"
				})]
			})] }),
			/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("p", {
				style: A.sectionTitle,
				children: "App Supabase"
			}), /* @__PURE__ */ (0, x.jsxs)("div", {
				style: {
					...A.card,
					display: "flex",
					flexDirection: "column",
					gap: 12
				},
				children: [
					/* @__PURE__ */ (0, x.jsxs)("div", {
						style: {
							display: "flex",
							alignItems: "center",
							gap: 8
						},
						children: [/* @__PURE__ */ (0, x.jsx)(R, { ok: n?.supabase }), /* @__PURE__ */ (0, x.jsx)("span", {
							style: {
								fontSize: 12.5,
								color: "var(--text-secondary)"
							},
							children: n?.supabase ? "App Supabase מוגדר" : "App Supabase לא מוגדר"
						})]
					}),
					/* @__PURE__ */ (0, x.jsx)(j, {
						label: "Supabase URL",
						children: /* @__PURE__ */ (0, x.jsx)(F, {
							value: e.secrets?.supabaseUrl,
							onChange: (e) => t("secrets.supabaseUrl", e),
							placeholder: "https://xxxx.supabase.co"
						})
					}),
					/* @__PURE__ */ (0, x.jsx)(ie, {
						label: "Service Role Key",
						value: e.secrets?.supabaseServiceRoleKey,
						onChange: (e) => t("secrets.supabaseServiceRoleKey", e),
						placeholder: "eyJ...",
						hint: "השאר ריק כדי לשמור את הערך הקיים"
					})
				]
			})] }),
			/* @__PURE__ */ (0, x.jsxs)(N, { children: [
				"המפתחות נשמרים בטבלת ",
				/* @__PURE__ */ (0, x.jsx)("code", {
					style: {
						background: "var(--surface-2)",
						padding: "1px 5px",
						borderRadius: 4,
						fontSize: 11.5,
						border: "1px solid var(--line)"
					},
					children: "agent_settings"
				}),
				" ב-Supabase. השאר שדות ריקים כדי לשמור את הערכים הקיימים."
			] })
		]
	});
}
function z({ agent: e, models: t, form: n, update: r }) {
	let i = n.models?.[e.key] || "", a = n.prompts?.[e.key] || "", o = n.ai?.[e.key] || {};
	return /* @__PURE__ */ (0, x.jsxs)("article", {
		style: {
			...A.card,
			display: "flex",
			flexDirection: "column",
			gap: 10,
			...e.wide ? { gridColumn: "1 / -1" } : {}
		},
		children: [
			/* @__PURE__ */ (0, x.jsx)("header", {
				style: {
					display: "flex",
					justifyContent: "space-between",
					alignItems: "flex-start"
				},
				children: /* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("strong", {
					style: {
						fontSize: 14,
						color: "var(--text-primary)"
					},
					children: e.label
				}), /* @__PURE__ */ (0, x.jsx)("p", {
					style: {
						...A.hint,
						marginTop: 2
					},
					children: e.desc
				})] })
			}),
			/* @__PURE__ */ (0, x.jsx)(j, {
				label: "מודל",
				children: /* @__PURE__ */ (0, x.jsx)(ae, {
					value: i,
					onChange: (t) => r(`models.${e.key}`, t),
					models: t
				})
			}),
			/* @__PURE__ */ (0, x.jsx)(L, {
				title: "פרומפט",
				children: /* @__PURE__ */ (0, x.jsx)(re, {
					value: a,
					rows: e.promptRows,
					onChange: (t) => r(`prompts.${e.key}`, t),
					placeholder: "פרומפט ברירת מחדל — השאר ריק כדי להשתמש בקבוע מ-prompts.js"
				})
			}),
			/* @__PURE__ */ (0, x.jsx)(L, {
				title: "הגדרות מודל",
				defaultOpen: !0,
				children: /* @__PURE__ */ (0, x.jsxs)("div", {
					style: {
						...A.grid3,
						marginTop: 8
					},
					children: [
						/* @__PURE__ */ (0, x.jsx)(j, {
							label: "Temperature",
							info: w.temperature,
							children: /* @__PURE__ */ (0, x.jsx)(F, {
								type: "number",
								value: o.temperature ?? 0,
								min: 0,
								max: 2,
								step: .05,
								onChange: (t) => r(`ai.${e.key}.temperature`, t)
							})
						}),
						/* @__PURE__ */ (0, x.jsx)(j, {
							label: "Max Tokens",
							info: w.maxTokens,
							children: /* @__PURE__ */ (0, x.jsx)(F, {
								type: "number",
								value: o.maxTokens ?? 4096,
								min: 16,
								max: 32e3,
								step: 50,
								onChange: (t) => r(`ai.${e.key}.maxTokens`, t)
							})
						}),
						/* @__PURE__ */ (0, x.jsx)(j, {
							label: "Timeout (ms)",
							info: w.timeoutMs,
							children: /* @__PURE__ */ (0, x.jsx)(F, {
								type: "number",
								value: o.timeoutMs ?? 9e4,
								min: 5e3,
								max: 18e4,
								step: 1e3,
								onChange: (t) => r(`ai.${e.key}.timeoutMs`, t)
							})
						})
					]
				})
			})
		]
	});
}
function se({ models: e, form: t, update: n, onRefreshModels: r, modelStatus: i }) {
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		style: A.section,
		children: [/* @__PURE__ */ (0, x.jsxs)("div", {
			style: {
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
				gap: 12,
				flexWrap: "wrap"
			},
			children: [/* @__PURE__ */ (0, x.jsx)(N, { children: "כל מה שמשפיע על תשובות הצ׳אט: מודלים, פרומפטים, הגדרות temperature ו-maxTokens לכל סוכן. השאר שדה ריק כדי להשתמש בפרומפט ברירת המחדל מ-prompts.js." }), /* @__PURE__ */ (0, x.jsxs)("div", {
				style: {
					display: "flex",
					alignItems: "center",
					gap: 10,
					flexShrink: 0
				},
				children: [i && /* @__PURE__ */ (0, x.jsx)("span", {
					style: {
						fontSize: 12,
						color: "var(--text-muted)"
					},
					children: i
				}), /* @__PURE__ */ (0, x.jsxs)(he, {
					onClick: r,
					title: "רענן רשימת מודלים מ-OpenRouter",
					children: [/* @__PURE__ */ (0, x.jsx)(O, {
						path: k.reload,
						size: 14
					}), " רענן מודלים"]
				})]
			})]
		}), /* @__PURE__ */ (0, x.jsx)("div", {
			style: {
				display: "grid",
				gridTemplateColumns: "1fr 1fr",
				gap: 14
			},
			children: C.map((r) => /* @__PURE__ */ (0, x.jsx)(z, {
				agent: r,
				models: e,
				form: t,
				update: n
			}, r.key))
		})]
	});
}
function ce({ models: e, form: t, update: n }) {
	return e.filter((e) => e.id?.includes("embed") || e.id?.includes("text-embed")), /* @__PURE__ */ (0, x.jsxs)("div", {
		style: A.section,
		children: [
			/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("p", {
				style: A.sectionTitle,
				children: "Embedding & Hybrid Search"
			}), /* @__PURE__ */ (0, x.jsx)("div", {
				style: A.card,
				children: /* @__PURE__ */ (0, x.jsxs)("div", {
					style: {
						...A.grid2,
						gap: 12
					},
					children: [
						/* @__PURE__ */ (0, x.jsx)(j, {
							label: "Embedding Model",
							wide: !0,
							info: w.embeddingModel,
							children: /* @__PURE__ */ (0, x.jsx)(ae, {
								value: t.models?.embedding,
								onChange: (e) => n("models.embedding", e),
								models: e
							})
						}),
						/* @__PURE__ */ (0, x.jsx)(j, {
							label: "Hybrid RPC Name",
							wide: !0,
							info: w.hybridRpcName,
							children: /* @__PURE__ */ (0, x.jsx)(F, {
								value: t.retrieval?.rpcName,
								onChange: (e) => n("retrieval.rpcName", e),
								placeholder: "hybrid_match_data_index_..."
							})
						}),
						/* @__PURE__ */ (0, x.jsx)(j, {
							label: "Hybrid Candidates",
							info: w.hybridCandidates,
							children: /* @__PURE__ */ (0, x.jsx)(F, {
								type: "number",
								value: t.retrieval?.candidates ?? 40,
								min: 1,
								max: 200,
								onChange: (e) => n("retrieval.candidates", e)
							})
						}),
						/* @__PURE__ */ (0, x.jsx)(j, {
							label: "Planner Candidates",
							info: w.plannerCandidates,
							children: /* @__PURE__ */ (0, x.jsx)(F, {
								type: "number",
								value: t.retrieval?.plannerCandidates ?? 20,
								min: 1,
								max: 100,
								onChange: (e) => n("retrieval.plannerCandidates", e)
							})
						}),
						/* @__PURE__ */ (0, x.jsx)(j, {
							label: "Alert Candidates",
							info: w.alertCandidates,
							children: /* @__PURE__ */ (0, x.jsx)(F, {
								type: "number",
								value: t.retrieval?.alertCandidates ?? 20,
								min: 1,
								max: 100,
								onChange: (e) => n("retrieval.alertCandidates", e)
							})
						}),
						/* @__PURE__ */ (0, x.jsx)(j, {
							label: "Reranker Top-K",
							info: w.rerankTopK,
							children: /* @__PURE__ */ (0, x.jsx)(F, {
								type: "number",
								value: t.retrieval?.rerankTopK ?? 10,
								min: 1,
								max: 100,
								onChange: (e) => n("retrieval.rerankTopK", e)
							})
						}),
						/* @__PURE__ */ (0, x.jsx)(j, {
							label: "Vector Weight",
							info: w.vectorWeight,
							children: /* @__PURE__ */ (0, x.jsx)(F, {
								type: "number",
								value: t.retrieval?.vectorWeight ?? .65,
								min: 0,
								max: 1,
								step: .05,
								onChange: (e) => n("retrieval.vectorWeight", e)
							})
						}),
						/* @__PURE__ */ (0, x.jsx)(j, {
							label: "Keyword Weight",
							info: w.keywordWeight,
							children: /* @__PURE__ */ (0, x.jsx)(F, {
								type: "number",
								value: t.retrieval?.keywordWeight ?? .35,
								min: 0,
								max: 1,
								step: .05,
								onChange: (e) => n("retrieval.keywordWeight", e)
							})
						})
					]
				})
			})] }),
			/* @__PURE__ */ (0, x.jsxs)("div", { children: [
				/* @__PURE__ */ (0, x.jsx)("p", {
					style: A.sectionTitle,
					children: "RAG Context"
				}),
				/* @__PURE__ */ (0, x.jsx)(N, { children: "קובע כמה מקורות וכמה טקסט מכל מקור נכנסים בפועל לתשובת ה-AI. השורות מצטמצמות לאורך המשפך: אחזור ראשוני → דירוג מחדש → context שנכנס לסוכן הראשי." }),
				/* @__PURE__ */ (0, x.jsx)("div", {
					style: {
						...A.card,
						marginTop: 10
					},
					children: /* @__PURE__ */ (0, x.jsxs)("div", {
						style: A.grid3,
						children: [
							/* @__PURE__ */ (0, x.jsx)(j, {
								label: "Context Records",
								info: w.ragContextRecordsLimit,
								children: /* @__PURE__ */ (0, x.jsx)(F, {
									type: "number",
									value: t.rag?.contextRecordsLimit ?? 12,
									min: 1,
									max: 50,
									onChange: (e) => n("rag.contextRecordsLimit", e)
								})
							}),
							/* @__PURE__ */ (0, x.jsx)(j, {
								label: "Chunk Text Limit",
								info: w.ragChunkTextLimit,
								children: /* @__PURE__ */ (0, x.jsx)(F, {
									type: "number",
									value: t.rag?.chunkTextLimit ?? 1800,
									min: 100,
									max: 1e4,
									onChange: (e) => n("rag.chunkTextLimit", e)
								})
							}),
							/* @__PURE__ */ (0, x.jsx)(j, {
								label: "Planner Extra Queries",
								info: w.ragPlannerExtraQueriesLimit,
								children: /* @__PURE__ */ (0, x.jsx)(F, {
									type: "number",
									value: t.rag?.plannerExtraQueriesLimit ?? 0,
									min: 0,
									max: 10,
									onChange: (e) => n("rag.plannerExtraQueriesLimit", e)
								})
							})
						]
					})
				})
			] }),
			/* @__PURE__ */ (0, x.jsxs)("div", { children: [
				/* @__PURE__ */ (0, x.jsx)("p", {
					style: A.sectionTitle,
					children: "Graph Context"
				}),
				/* @__PURE__ */ (0, x.jsx)(N, { children: "קובע האם וכמה קשרים מגרף הפרויקט ייכנסו לשאלות RAG — קישורי לוח זמנים, קשרי ישויות ואיתותים." }),
				/* @__PURE__ */ (0, x.jsxs)("div", {
					style: {
						...A.card,
						marginTop: 10,
						display: "flex",
						flexDirection: "column",
						gap: 14
					},
					children: [
						/* @__PURE__ */ (0, x.jsxs)("div", {
							style: A.grid2,
							children: [/* @__PURE__ */ (0, x.jsx)(j, {
								label: "Graph Search Limit",
								info: w.graphSearchLimit,
								children: /* @__PURE__ */ (0, x.jsx)(F, {
									type: "number",
									value: t.graph?.searchLimit ?? 30,
									min: 1,
									max: 100,
									onChange: (e) => n("graph.searchLimit", e)
								})
							}), /* @__PURE__ */ (0, x.jsx)(j, {
								label: "Graph Context Limit",
								info: w.graphContextLimit,
								children: /* @__PURE__ */ (0, x.jsx)(F, {
									type: "number",
									value: t.graph?.contextLimit ?? 12,
									min: 1,
									max: 50,
									onChange: (e) => n("graph.contextLimit", e)
								})
							})]
						}),
						/* @__PURE__ */ (0, x.jsx)(ne, {
							label: "להשתמש בגרף בתשובות צ׳אט",
							checked: t.graph?.enabled !== !1,
							onChange: (e) => n("graph.enabled", e),
							info: w.graphEnabled
						}),
						/* @__PURE__ */ (0, x.jsx)(ne, {
							label: "להרחיב גרף בשאלות רשימה/חקירה",
							checked: t.graph?.expandedForListQuestions !== !1,
							onChange: (e) => n("graph.expandedForListQuestions", e),
							info: w.graphExpandedForListQuestions
						})
					]
				})
			] }),
			/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("p", {
				style: A.sectionTitle,
				children: "Timeline"
			}), /* @__PURE__ */ (0, x.jsx)("div", {
				style: A.card,
				children: /* @__PURE__ */ (0, x.jsxs)("div", {
					style: A.grid2,
					children: [/* @__PURE__ */ (0, x.jsx)(j, {
						label: "Timeline Limit (rows)",
						info: w.timelineLimit,
						children: /* @__PURE__ */ (0, x.jsx)(F, {
							type: "number",
							value: t.retrieval?.timelineLimit ?? 1e3,
							min: 10,
							max: 1e4,
							onChange: (e) => n("retrieval.timelineLimit", e)
						})
					}), /* @__PURE__ */ (0, x.jsx)(j, {
						label: "Days Back",
						info: w.timelineDaysBack,
						children: /* @__PURE__ */ (0, x.jsx)(F, {
							type: "number",
							value: t.retrieval?.timelineDaysBack ?? 1825,
							min: 1,
							max: 36500,
							onChange: (e) => n("retrieval.timelineDaysBack", e)
						})
					})]
				})
			})] })
		]
	});
}
function le({ form: e, update: t, configStatus: n }) {
	let r = e.contentSource?.useAppSupabase === !0;
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		style: A.section,
		children: [
			/* @__PURE__ */ (0, x.jsxs)("div", {
				style: {
					display: "flex",
					alignItems: "center",
					gap: 8
				},
				children: [/* @__PURE__ */ (0, x.jsx)(R, { ok: n?.contentSupabase }), /* @__PURE__ */ (0, x.jsx)("span", {
					style: {
						fontSize: 12.5,
						color: "var(--text-secondary)"
					},
					children: n?.contentSupabase ? "APP DATA מוגדר" : "APP DATA לא מוגדר — המערכת תשתמש ב-App Supabase"
				})]
			}),
			/* @__PURE__ */ (0, x.jsxs)("div", {
				style: {
					...A.card,
					display: "flex",
					flexDirection: "column",
					gap: 12
				},
				children: [
					/* @__PURE__ */ (0, x.jsx)(ne, {
						label: "השתמש ב-App Supabase של MAIN",
						checked: r,
						onChange: (e) => t("contentSource.useAppSupabase", e)
					}),
					/* @__PURE__ */ (0, x.jsx)(j, {
						label: "APP DATA Supabase URL",
						children: /* @__PURE__ */ (0, x.jsx)(F, {
							value: e.contentSource?.supabaseUrl,
							onChange: (e) => t("contentSource.supabaseUrl", e),
							placeholder: "https://content-project.supabase.co",
							disabled: r
						})
					}),
					/* @__PURE__ */ (0, x.jsx)(ie, {
						label: "Service Role Key",
						value: e.contentSource?.supabaseServiceRoleKey,
						onChange: (e) => t("contentSource.supabaseServiceRoleKey", e),
						placeholder: "sb_secret_...",
						disabled: r
					}),
					/* @__PURE__ */ (0, x.jsxs)("div", {
						style: A.grid2,
						children: [
							/* @__PURE__ */ (0, x.jsx)(j, {
								label: "Hybrid RPC Name",
								children: /* @__PURE__ */ (0, x.jsx)(F, {
									value: e.contentSource?.hybridRpcName,
									onChange: (e) => t("contentSource.hybridRpcName", e),
									placeholder: "hybrid_match_data_index..."
								})
							}),
							/* @__PURE__ */ (0, x.jsx)(j, {
								label: "Index Table",
								children: /* @__PURE__ */ (0, x.jsx)(F, {
									value: e.contentSource?.indexTable,
									onChange: (e) => t("contentSource.indexTable", e),
									placeholder: "data_index_embeddings_gf"
								})
							}),
							/* @__PURE__ */ (0, x.jsx)(j, {
								label: "Alerts Table",
								children: /* @__PURE__ */ (0, x.jsx)(F, {
									value: e.contentSource?.alertsTable,
									onChange: (e) => t("contentSource.alertsTable", e),
									placeholder: "alerts_embeddings_gf"
								})
							}),
							/* @__PURE__ */ (0, x.jsx)(j, {
								label: "Alerts RPC Name",
								children: /* @__PURE__ */ (0, x.jsx)(F, {
									value: e.contentSource?.alertsRpcName,
									onChange: (e) => t("contentSource.alertsRpcName", e),
									placeholder: "match_alerts_embeddings_gf"
								})
							})
						]
					})
				]
			}),
			/* @__PURE__ */ (0, x.jsx)(N, { children: "APP DATA הוא פרויקט KAPAIM ב-Supabase ומשמש את כל סוכני המידע, RAG, timeline, alerts ו-Schedule. כשהמתג פעיל, הכתובת והמפתח נלקחים מחיבור App Supabase של MAIN." })
		]
	});
}
function ue({ form: e, update: t }) {
	let n = Object.keys(e.tools || {});
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		style: A.section,
		children: [
			/* @__PURE__ */ (0, x.jsx)(N, { children: "כתובת ה-n8n Base URL משמשת בסיס לכל ה-webhooks. כתובות ספציפיות לכלי עוקפות את ה-Base URL עבור אותו כלי בלבד. אם אין שימוש ב-n8n ניתן להשאיר ריק." }),
			/* @__PURE__ */ (0, x.jsx)("div", {
				style: A.card,
				children: /* @__PURE__ */ (0, x.jsx)(j, {
					label: "n8n Base URL",
					hint: "כתובת ה-n8n instance שממנה נקראים ה-webhooks",
					children: /* @__PURE__ */ (0, x.jsx)(F, {
						value: e.n8nBaseUrl,
						onChange: (e) => t("n8nBaseUrl", e),
						placeholder: "https://your-n8n.cloud/webhook"
					})
				})
			}),
			n.length > 0 && /* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("p", {
				style: A.sectionTitle,
				children: "כתובות כלים"
			}), /* @__PURE__ */ (0, x.jsx)("div", {
				style: {
					...A.card,
					display: "flex",
					flexDirection: "column",
					gap: 10
				},
				children: n.map((n) => /* @__PURE__ */ (0, x.jsx)(j, {
					label: n,
					children: /* @__PURE__ */ (0, x.jsx)(F, {
						value: e.tools[n],
						onChange: (e) => t(`tools.${n}`, e),
						placeholder: `Override URL for ${n}`
					})
				}, n))
			})] })
		]
	});
}
function de({ form: e, update: t }) {
	let n = e.toolsRuntime || {}, r = e.ai?.alert || {}, i = e.cache || {}, a = i.provider || "memory";
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		style: A.section,
		children: [
			/* @__PURE__ */ (0, x.jsx)(N, { children: "שולט בהפעלת כלים חיצוניים, סוכן ההתראות וה-Cache — בלי לשנות את כתובות ה-webhooks." }),
			/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("p", {
				style: A.sectionTitle,
				children: "כלי N8N — ריצה"
			}), /* @__PURE__ */ (0, x.jsxs)("div", {
				style: {
					...A.card,
					display: "flex",
					flexDirection: "column",
					gap: 14
				},
				children: [
					/* @__PURE__ */ (0, x.jsx)(ne, {
						label: "להפעיל כלי N8N",
						checked: n.enabled !== !1,
						onChange: (e) => t("toolsRuntime.enabled", e),
						info: w.toolsEnabled
					}),
					/* @__PURE__ */ (0, x.jsx)(ne, {
						label: "להפעיל Alert Agent",
						checked: n.alertAgentEnabled !== !1,
						onChange: (e) => t("toolsRuntime.alertAgentEnabled", e),
						info: w.toolsAlertAgentEnabled
					}),
					/* @__PURE__ */ (0, x.jsx)(ne, {
						label: "להפעיל בדיקת בטיחות מוקדמת",
						checked: n.safetyPrecheckEnabled !== !1,
						onChange: (e) => t("toolsRuntime.safetyPrecheckEnabled", e),
						info: w.toolsSafetyPrecheckEnabled
					}),
					/* @__PURE__ */ (0, x.jsx)(j, {
						label: "Parallel Tool Calls Limit",
						info: w.toolsParallelLimit,
						children: /* @__PURE__ */ (0, x.jsx)(F, {
							type: "number",
							value: n.parallelLimit ?? 6,
							min: 1,
							max: 20,
							onChange: (e) => t("toolsRuntime.parallelLimit", e)
						})
					})
				]
			})] }),
			/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("p", {
				style: A.sectionTitle,
				children: "סוכן Alert — הגדרות מודל"
			}), /* @__PURE__ */ (0, x.jsx)("div", {
				style: { ...A.card },
				children: /* @__PURE__ */ (0, x.jsxs)("div", {
					style: A.grid3,
					children: [
						/* @__PURE__ */ (0, x.jsx)(j, {
							label: "Temperature",
							info: w.alertTemperature,
							children: /* @__PURE__ */ (0, x.jsx)(F, {
								type: "number",
								value: r.temperature ?? 0,
								min: 0,
								max: 2,
								step: .05,
								onChange: (e) => t("ai.alert.temperature", e)
							})
						}),
						/* @__PURE__ */ (0, x.jsx)(j, {
							label: "Max Tokens",
							info: w.alertMaxTokens,
							children: /* @__PURE__ */ (0, x.jsx)(F, {
								type: "number",
								value: r.maxTokens ?? 4096,
								min: 16,
								max: 32e3,
								step: 50,
								onChange: (e) => t("ai.alert.maxTokens", e)
							})
						}),
						/* @__PURE__ */ (0, x.jsx)(j, {
							label: "Timeout (ms)",
							info: w.alertTimeoutMs,
							children: /* @__PURE__ */ (0, x.jsx)(F, {
								type: "number",
								value: r.timeoutMs ?? 9e4,
								min: 5e3,
								max: 18e4,
								step: 1e3,
								onChange: (e) => t("ai.alert.timeoutMs", e)
							})
						})
					]
				})
			})] }),
			/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("p", {
				style: A.sectionTitle,
				children: "Cache"
			}), /* @__PURE__ */ (0, x.jsxs)("div", {
				style: {
					...A.card,
					display: "flex",
					flexDirection: "column",
					gap: 14
				},
				children: [
					/* @__PURE__ */ (0, x.jsx)(ne, {
						label: "להפעיל Cache",
						checked: i.enabled !== !1,
						onChange: (e) => t("cache.enabled", e),
						info: w.cacheEnabled
					}),
					/* @__PURE__ */ (0, x.jsxs)("div", {
						style: A.grid2,
						children: [/* @__PURE__ */ (0, x.jsx)(j, {
							label: "Cache Provider",
							info: w.cacheProvider,
							children: /* @__PURE__ */ (0, x.jsxs)(I, {
								value: a,
								onChange: (e) => t("cache.provider", e),
								children: [
									/* @__PURE__ */ (0, x.jsx)("option", {
										value: "memory",
										children: "Memory — פיתוח"
									}),
									/* @__PURE__ */ (0, x.jsx)("option", {
										value: "redis",
										children: "Redis — Production"
									}),
									/* @__PURE__ */ (0, x.jsx)("option", {
										value: "none",
										children: "ללא Cache"
									})
								]
							})
						}), /* @__PURE__ */ (0, x.jsx)(j, {
							label: "Memory Max Entries",
							info: w.cacheMemoryMaxEntries,
							children: /* @__PURE__ */ (0, x.jsx)(F, {
								type: "number",
								value: i.memoryMaxEntries ?? 1e4,
								min: 100,
								max: 1e6,
								step: 100,
								onChange: (e) => t("cache.memoryMaxEntries", e)
							})
						})]
					}),
					/* @__PURE__ */ (0, x.jsx)(ie, {
						label: "Redis URL",
						value: i.redisUrl,
						onChange: (e) => t("cache.redisUrl", e),
						placeholder: "redis://default:password@host:6379",
						hint: "השאר ריק כדי לשמור את הערך הקיים",
						info: w.cacheRedisUrl
					})
				]
			})] })
		]
	});
}
function fe({ form: e, onApplyPreset: t, onSavePreset: n }) {
	let [r, i] = (0, b.useState)(""), [a, o] = (0, b.useState)(""), s = e.presets || [], c = s.find((e) => e.name === r);
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		style: A.section,
		children: [
			/* @__PURE__ */ (0, x.jsx)(N, { children: "בחירה מהירה של תצורות מוכנות. טעינת פריסט מעדכנת את הטופס בלבד — לחץ \"שמור\" כדי לכתוב ל-Supabase." }),
			/* @__PURE__ */ (0, x.jsxs)("div", {
				style: A.card,
				children: [/* @__PURE__ */ (0, x.jsx)("p", {
					style: A.sectionTitle,
					children: "בחר פריסט"
				}), /* @__PURE__ */ (0, x.jsxs)("div", {
					style: {
						display: "flex",
						flexDirection: "column",
						gap: 10
					},
					children: [
						/* @__PURE__ */ (0, x.jsxs)(I, {
							value: r,
							onChange: i,
							children: [/* @__PURE__ */ (0, x.jsx)("option", {
								value: "",
								children: "— בחר פריסט —"
							}), s.map((e) => /* @__PURE__ */ (0, x.jsx)("option", {
								value: e.name,
								children: e.name
							}, e.name))]
						}),
						c && /* @__PURE__ */ (0, x.jsx)("p", {
							style: {
								...A.hint,
								background: "var(--surface-3)",
								padding: "8px 12px",
								borderRadius: "var(--r)",
								border: "1px solid var(--line)"
							},
							children: c.description || "אין תיאור לפריסט זה."
						}),
						/* @__PURE__ */ (0, x.jsx)(he, {
							onClick: () => r && t(r),
							disabled: !r,
							children: "טען פריסט"
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, x.jsxs)("div", {
				style: A.card,
				children: [/* @__PURE__ */ (0, x.jsx)("p", {
					style: A.sectionTitle,
					children: "שמור פריסט חדש"
				}), /* @__PURE__ */ (0, x.jsxs)("div", {
					style: {
						display: "flex",
						gap: 8
					},
					children: [/* @__PURE__ */ (0, x.jsx)(F, {
						value: a,
						onChange: o,
						placeholder: "שם לפריסט חדש..."
					}), /* @__PURE__ */ (0, x.jsx)(he, {
						variant: "primary",
						disabled: !a.trim(),
						style: { whiteSpace: "nowrap" },
						onClick: () => {
							a.trim() && (n(a.trim()), o(""));
						},
						children: "שמור"
					})]
				})]
			})
		]
	});
}
function pe({ form: e, update: t }) {
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		style: A.section,
		children: [
			/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("p", {
				style: A.sectionTitle,
				children: "אזור זמן"
			}), /* @__PURE__ */ (0, x.jsx)("div", {
				style: A.card,
				children: /* @__PURE__ */ (0, x.jsx)(j, {
					label: "אזור זמן",
					hint: "אזור הזמן משפיע על כל שאלות הזמן שנשאלות בסוכן",
					children: /* @__PURE__ */ (0, x.jsx)(I, {
						value: e.timezone,
						onChange: (e) => t("timezone", e),
						children: T.map((e) => /* @__PURE__ */ (0, x.jsx)("option", {
							value: e,
							children: e
						}, e))
					})
				})
			})] }),
			/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("p", {
				style: A.sectionTitle,
				children: "Knowledge Base Vocabulary"
			}), /* @__PURE__ */ (0, x.jsx)("div", {
				style: A.card,
				children: /* @__PURE__ */ (0, x.jsx)(j, {
					label: "מילות מפתח שמפעילות את Knowledge Base Agent",
					hint: "כאשר אחת מהמילים מופיעה בשאלת המשתמש, המערכת תפעיל את Professional Knowledge Agent",
					children: /* @__PURE__ */ (0, x.jsx)(re, {
						value: e.knowledge?.triggerKeywords,
						rows: 6,
						onChange: (e) => t("knowledge.triggerKeywords", e),
						placeholder: "חסמים\nסיכונים\nתלויות"
					})
				})
			})] }),
			/* @__PURE__ */ (0, x.jsxs)("div", { children: [
				/* @__PURE__ */ (0, x.jsx)("p", {
					style: A.sectionTitle,
					children: "Knowledge Base — הגדרות מתקדמות"
				}),
				/* @__PURE__ */ (0, x.jsx)(N, { children: "שולט בכמה ידע מקומי נכנס לתכנון החיפוש המקצועי." }),
				/* @__PURE__ */ (0, x.jsx)("div", {
					style: {
						...A.card,
						marginTop: 10
					},
					children: /* @__PURE__ */ (0, x.jsxs)("div", {
						style: A.grid3,
						children: [
							/* @__PURE__ */ (0, x.jsx)(j, {
								label: "Knowledge Agent Limit",
								info: w.knowledgeAgentLimit,
								children: /* @__PURE__ */ (0, x.jsx)(F, {
									type: "number",
									value: e.knowledge?.agentLimit ?? 2,
									min: 1,
									max: 5,
									onChange: (e) => t("knowledge.agentLimit", e)
								})
							}),
							/* @__PURE__ */ (0, x.jsx)(j, {
								label: "Knowledge Top K",
								info: w.knowledgeTopK,
								children: /* @__PURE__ */ (0, x.jsx)(F, {
									type: "number",
									value: e.knowledge?.topK ?? 4,
									min: 1,
									max: 20,
									onChange: (e) => t("knowledge.topK", e)
								})
							}),
							/* @__PURE__ */ (0, x.jsx)(j, {
								label: "Knowledge Chunk Size",
								info: w.knowledgeChunkSize,
								children: /* @__PURE__ */ (0, x.jsx)(F, {
									type: "number",
									value: e.knowledge?.chunkSize ?? 1800,
									min: 300,
									max: 6e3,
									step: 100,
									onChange: (e) => t("knowledge.chunkSize", e)
								})
							})
						]
					})
				})
			] })
		]
	});
}
function me(e = "secondary", t = !1) {
	let n = {
		display: "inline-flex",
		alignItems: "center",
		gap: 6,
		padding: "7px 14px",
		borderRadius: "var(--r)",
		border: "none",
		cursor: t ? "default" : "pointer",
		fontFamily: "var(--font-display)",
		fontSize: 13,
		fontWeight: 500,
		transition: "all .15s",
		opacity: t ? .5 : 1
	};
	return e === "primary" ? {
		...n,
		background: "var(--brand-500)",
		color: "#fff",
		boxShadow: "0 1px 2px rgba(63,141,104,.25)"
	} : e === "danger" ? {
		...n,
		background: "var(--danger)",
		color: "#fff"
	} : {
		...n,
		background: "var(--surface-3)",
		color: "var(--text-primary)",
		border: "1px solid var(--line-strong)"
	};
}
function he({ variant: e = "secondary", disabled: t = !1, onClick: n, children: r, title: i, style: a }) {
	let [o, s] = (0, b.useState)(!1), c = me(e, t), l = !t && o ? e === "primary" ? {
		background: "var(--brand-600, #2f7355)",
		boxShadow: "0 3px 10px rgba(63,141,104,.34)",
		transform: "translateY(-1px)"
	} : e === "danger" ? {
		filter: "brightness(.92)",
		transform: "translateY(-1px)"
	} : {
		background: "var(--surface-2)",
		borderColor: "var(--brand-500)",
		color: "var(--brand-600, var(--brand-500))"
	} : {};
	return /* @__PURE__ */ (0, x.jsx)("button", {
		type: "button",
		onClick: n,
		disabled: t,
		title: i,
		onMouseEnter: () => s(!0),
		onMouseLeave: () => s(!1),
		style: {
			...c,
			...l,
			...a
		},
		children: r
	});
}
function ge({ sec: e, isActive: t, onSelect: n }) {
	let [r, i] = (0, b.useState)(!1);
	return /* @__PURE__ */ (0, x.jsxs)("button", {
		onClick: () => n(e.id),
		onMouseEnter: () => i(!0),
		onMouseLeave: () => i(!1),
		style: {
			position: "relative",
			display: "flex",
			alignItems: "center",
			gap: 10,
			padding: "9px 12px",
			borderRadius: "var(--r)",
			border: "none",
			background: t ? "var(--brand-50)" : r ? "var(--surface-2)" : "transparent",
			color: t ? "var(--brand-600, var(--brand-500))" : "var(--text-secondary)",
			fontWeight: t ? 700 : 500,
			fontSize: 13.5,
			cursor: "pointer",
			textAlign: "right",
			fontFamily: "var(--font-display)",
			transition: "all .15s",
			width: "100%"
		},
		children: [
			t && /* @__PURE__ */ (0, x.jsx)("span", { style: {
				position: "absolute",
				insetInlineEnd: 0,
				top: "50%",
				transform: "translateY(-50%)",
				width: 3,
				height: 18,
				borderRadius: 3,
				background: "var(--brand-500)"
			} }),
			/* @__PURE__ */ (0, x.jsx)(O, {
				path: k[e.id] || k.general,
				size: 16,
				style: {
					color: t ? "var(--brand-500)" : "var(--text-muted)",
					flexShrink: 0
				}
			}),
			e.label
		]
	});
}
function _e({ active: e, onSelect: t }) {
	return /* @__PURE__ */ (0, x.jsx)("nav", {
		style: {
			width: 188,
			flexShrink: 0,
			display: "flex",
			flexDirection: "column",
			gap: 3,
			position: "sticky",
			top: 0,
			alignSelf: "flex-start",
			background: "var(--surface)",
			border: "1px solid var(--line)",
			borderRadius: "var(--r-xl)",
			padding: 8,
			boxShadow: "0 1px 4px rgba(0,0,0,.04)"
		},
		children: S.map((n) => /* @__PURE__ */ (0, x.jsx)(ge, {
			sec: n,
			isActive: n.id === e,
			onSelect: t
		}, n.id))
	});
}
function ve({ saveState: e, onSave: t, onReload: n, onExport: r, onImport: i, fileRef: a }) {
	let o = e === "saving", s = e === "saved", c = e === "error";
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		style: {
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between",
			paddingBottom: 16,
			borderBottom: "1px solid var(--line)",
			marginBottom: 20,
			gap: 12,
			flexWrap: "wrap"
		},
		children: [/* @__PURE__ */ (0, x.jsxs)("div", {
			style: {
				display: "flex",
				alignItems: "center",
				gap: 10
			},
			children: [
				/* @__PURE__ */ (0, x.jsx)("h2", {
					style: {
						margin: 0,
						fontSize: 18,
						fontWeight: 700,
						color: "var(--text-primary)"
					},
					children: "הגדרות"
				}),
				s && /* @__PURE__ */ (0, x.jsxs)("span", {
					style: {
						display: "inline-flex",
						alignItems: "center",
						gap: 4,
						fontSize: 12,
						color: "var(--success-text)",
						background: "var(--success-bg)",
						padding: "3px 9px",
						borderRadius: 20,
						border: "1px solid var(--success-border)"
					},
					children: [/* @__PURE__ */ (0, x.jsx)(O, {
						path: k.check,
						size: 11
					}), " נשמר"]
				}),
				c && /* @__PURE__ */ (0, x.jsxs)("span", {
					style: {
						display: "inline-flex",
						alignItems: "center",
						gap: 4,
						fontSize: 12,
						color: "var(--error-text)",
						background: "var(--error-bg)",
						padding: "3px 9px",
						borderRadius: 20,
						border: "1px solid var(--error-border)"
					},
					children: [/* @__PURE__ */ (0, x.jsx)(O, {
						path: k.warning,
						size: 11
					}), " שגיאה בשמירה"]
				})
			]
		}), /* @__PURE__ */ (0, x.jsxs)("div", {
			style: {
				display: "flex",
				gap: 8,
				alignItems: "center"
			},
			children: [
				/* @__PURE__ */ (0, x.jsxs)(he, {
					onClick: n,
					title: "רענן מ-Supabase",
					children: [/* @__PURE__ */ (0, x.jsx)(O, {
						path: k.reload,
						size: 14
					}), " רענן"]
				}),
				/* @__PURE__ */ (0, x.jsxs)(he, {
					onClick: r,
					title: "הורד קובץ הגדרות",
					children: [/* @__PURE__ */ (0, x.jsx)(O, {
						path: k.download,
						size: 14
					}), " ייצוא"]
				}),
				/* @__PURE__ */ (0, x.jsxs)("label", {
					style: {
						...me("secondary"),
						cursor: "pointer"
					},
					title: "טען קובץ הגדרות",
					children: [
						/* @__PURE__ */ (0, x.jsx)(O, {
							path: k.upload,
							size: 14
						}),
						" ייבוא",
						/* @__PURE__ */ (0, x.jsx)("input", {
							ref: a,
							type: "file",
							accept: ".json",
							hidden: !0,
							onChange: i
						})
					]
				}),
				/* @__PURE__ */ (0, x.jsxs)(he, {
					variant: "primary",
					onClick: t,
					disabled: o,
					children: [/* @__PURE__ */ (0, x.jsx)(O, {
						path: k.save,
						size: 14
					}), o ? "שומר..." : "שמור"]
				})
			]
		})]
	});
}
function ye({ label: e, ok: t, detail: n }) {
	return /* @__PURE__ */ (0, x.jsxs)("span", {
		style: {
			display: "inline-flex",
			alignItems: "center",
			gap: 5
		},
		children: [
			/* @__PURE__ */ (0, x.jsx)("span", { style: {
				width: 7,
				height: 7,
				borderRadius: "50%",
				background: t === !0 ? "#22c55e" : t === !1 ? "#ef4444" : "#94a3b8",
				flexShrink: 0
			} }),
			/* @__PURE__ */ (0, x.jsxs)("span", {
				style: {
					fontWeight: 600,
					color: "var(--text-primary)"
				},
				children: [e, ":"]
			}),
			/* @__PURE__ */ (0, x.jsx)("span", {
				style: { color: t === !1 ? "#ef4444" : "var(--text-secondary, var(--text-muted))" },
				children: t === !0 ? "מוגדר" : t === !1 ? "לא מוגדר" : n
			}),
			n && t !== void 0 && /* @__PURE__ */ (0, x.jsxs)("span", {
				style: {
					color: "var(--text-muted)",
					fontSize: 11
				},
				children: [
					"(",
					n,
					")"
				]
			})
		]
	});
}
function be({ configStatus: e, form: t, saveState: n }) {
	let r = t.contentSource || {}, i = r.supabaseUrl ? r.supabaseUrl.replace(/^https?:\/\//, "").split(".")[0] : null, a = n === "saved", o = n === "error", s = n === "saving";
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		style: {
			display: "flex",
			flexWrap: "wrap",
			alignItems: "center",
			gap: "6px 0",
			padding: "9px 14px",
			background: "var(--surface-2)",
			border: "1px solid var(--line)",
			borderRadius: "var(--r)",
			marginBottom: 18,
			fontSize: 12,
			fontFamily: "var(--font-display)",
			lineHeight: 1.4
		},
		children: [
			/* @__PURE__ */ (0, x.jsx)(ye, {
				label: "OpenRouter",
				ok: e.openRouter
			}),
			/* @__PURE__ */ (0, x.jsx)(xe, {}),
			/* @__PURE__ */ (0, x.jsx)(ye, {
				label: "App DB",
				ok: e.supabase
			}),
			/* @__PURE__ */ (0, x.jsx)(xe, {}),
			/* @__PURE__ */ (0, x.jsx)(ye, {
				label: "APP DATA",
				ok: e.contentSupabase,
				detail: i
			}),
			r.hybridRpcName && /* @__PURE__ */ (0, x.jsxs)(x.Fragment, { children: [/* @__PURE__ */ (0, x.jsx)(xe, {}), /* @__PURE__ */ (0, x.jsx)(ye, {
				label: "Content RPC",
				detail: r.hybridRpcName
			})] }),
			(r.indexTable || r.alertsTable) && /* @__PURE__ */ (0, x.jsxs)(x.Fragment, { children: [/* @__PURE__ */ (0, x.jsx)(xe, {}), /* @__PURE__ */ (0, x.jsx)(ye, {
				label: "Tables",
				detail: [r.indexTable, r.alertsTable].filter(Boolean).join(", ")
			})] }),
			/* @__PURE__ */ (0, x.jsx)("span", { style: {
				marginRight: "auto",
				paddingRight: 4
			} }),
			s && /* @__PURE__ */ (0, x.jsx)("span", {
				style: {
					color: "var(--text-muted)",
					fontSize: 11
				},
				children: "שומר..."
			}),
			a && /* @__PURE__ */ (0, x.jsx)("span", {
				style: {
					color: "#22c55e",
					fontSize: 11,
					fontWeight: 600
				},
				children: "✓ נשמר בהצלחה"
			}),
			o && /* @__PURE__ */ (0, x.jsx)("span", {
				style: {
					color: "#ef4444",
					fontSize: 11,
					fontWeight: 600
				},
				children: "✗ שגיאה בשמירה"
			}),
			!s && !a && !o && /* @__PURE__ */ (0, x.jsx)("span", {
				style: {
					color: "var(--text-muted)",
					fontSize: 11
				},
				children: "ההגדרות נטענו מ-Supabase"
			})
		]
	});
}
function xe() {
	return /* @__PURE__ */ (0, x.jsx)("span", {
		style: {
			color: "var(--line-strong, #cbd5e1)",
			margin: "0 8px"
		},
		children: "|"
	});
}
function Se() {
	let [e, t] = (0, b.useState)({}), [n, r] = (0, b.useState)([]), [i, a] = (0, b.useState)(!0), [o, s] = (0, b.useState)("connections"), [c, l] = (0, b.useState)("idle"), [u, d] = (0, b.useState)({}), [f, p] = (0, b.useState)(""), m = (0, b.useRef)(null);
	(0, b.useEffect)(() => {
		Promise.all([E("/api/settings").catch(() => null), E("/api/openrouter/models").catch(() => ({ models: [] }))]).then(([e, n]) => {
			let i = e?.settings ?? e;
			i && (t(D(i)), d({
				openRouter: i.openRouterConfigured,
				supabase: i.supabaseConfigured,
				contentSupabase: i.contentSupabaseConfigured
			})), r(n?.models || []), a(!1);
		});
	}, []);
	let h = (0, b.useCallback)((e, n) => {
		t((t) => ee(t, e, n)), l("idle");
	}, []), g = async () => {
		l("saving");
		try {
			let t = await E("/api/settings", {
				method: "PUT",
				body: te(e)
			});
			t?.settings && d({
				openRouter: t.settings.openRouterConfigured,
				supabase: t.settings.supabaseConfigured,
				contentSupabase: t.settings.contentSupabaseConfigured
			}), l("saved"), setTimeout(() => l("idle"), 3e3);
		} catch {
			l("error");
		}
	}, _ = async () => {
		try {
			let e = await E("/api/settings/reload", {
				method: "POST",
				body: {}
			});
			e?.settings && (t(D(e.settings)), d({
				openRouter: e.settings.openRouterConfigured,
				supabase: e.settings.supabaseConfigured,
				contentSupabase: e.settings.contentSupabaseConfigured
			}), l("saved"), setTimeout(() => l("idle"), 2e3));
		} catch {}
	}, v = async () => {
		try {
			let e = await E("/api/settings/export"), t = new Blob([JSON.stringify(e, null, 2)], { type: "application/json" }), n = document.createElement("a");
			n.href = URL.createObjectURL(t), n.download = "bidoc-settings.json", n.click();
		} catch {}
	}, y = async (e) => {
		let n = e.target.files?.[0];
		if (!n) return;
		let r = await n.text();
		try {
			let e = await E("/api/settings/import", {
				method: "POST",
				body: JSON.parse(r)
			});
			e?.settings && t(D(e.settings));
		} catch {}
		m.current && (m.current.value = "");
	}, S = async (e) => {
		try {
			let n = await E("/api/settings/preset/apply", {
				method: "POST",
				body: { name: e }
			});
			n?.settings && t(D(n.settings));
		} catch {}
	}, C = async (t) => {
		try {
			await E("/api/settings/preset", {
				method: "POST",
				body: {
					name: t,
					settings: te(e)
				}
			});
		} catch {}
	}, w = async () => {
		p("טוען רשימת מודלים מ-OpenRouter...");
		try {
			let e = await E("/api/openrouter/models");
			r(e?.models || []), p(`נטענו ${e?.models?.length || 0} מודלים`), setTimeout(() => p(""), 3e3);
		} catch {
			p("שגיאה בטעינת מודלים");
		}
	};
	if (i) return /* @__PURE__ */ (0, x.jsx)("div", {
		style: {
			padding: 40,
			textAlign: "center",
			color: "var(--text-muted)",
			fontFamily: "var(--font-display)"
		},
		children: "טוען הגדרות..."
	});
	let T = {
		form: e,
		update: h,
		models: n,
		configStatus: u
	};
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		dir: "rtl",
		style: {
			fontFamily: "var(--font-display)",
			color: "var(--text-primary)"
		},
		children: [
			/* @__PURE__ */ (0, x.jsx)("style", { children: "\n        @keyframes bidocFade { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }\n        @media (prefers-reduced-motion: reduce) {\n          [data-react-island=\"settings\"] * { animation-duration: .001ms !important; transition-duration: .001ms !important; }\n        }\n        @media (max-width: 720px) {\n          [data-bidoc-settings-layout] { flex-direction: column !important; }\n          [data-bidoc-settings-layout] > nav { width: 100% !important; flex-direction: row !important; overflow-x: auto; }\n        }\n      " }),
			/* @__PURE__ */ (0, x.jsx)(ve, {
				saveState: c,
				onSave: g,
				onReload: _,
				onExport: v,
				onImport: y,
				fileRef: m
			}),
			/* @__PURE__ */ (0, x.jsx)(be, {
				configStatus: u,
				form: e,
				saveState: c
			}),
			/* @__PURE__ */ (0, x.jsxs)("div", {
				"data-bidoc-settings-layout": !0,
				style: {
					display: "flex",
					gap: 28,
					alignItems: "flex-start"
				},
				children: [/* @__PURE__ */ (0, x.jsx)(_e, {
					active: o,
					onSelect: s
				}), /* @__PURE__ */ (0, x.jsxs)("div", {
					style: {
						flex: 1,
						minWidth: 0,
						animation: "bidocFade .18s ease-out"
					},
					children: [
						o === "connections" && /* @__PURE__ */ (0, x.jsx)(oe, { ...T }),
						o === "agents" && /* @__PURE__ */ (0, x.jsx)(se, {
							...T,
							onRefreshModels: w,
							modelStatus: f
						}),
						o === "retrieval" && /* @__PURE__ */ (0, x.jsx)(ce, { ...T }),
						o === "content" && /* @__PURE__ */ (0, x.jsx)(le, { ...T }),
						o === "tools" && /* @__PURE__ */ (0, x.jsx)(ue, { ...T }),
						o === "performance" && /* @__PURE__ */ (0, x.jsx)(de, { ...T }),
						o === "presets" && /* @__PURE__ */ (0, x.jsx)(fe, {
							...T,
							onApplyPreset: S,
							onSavePreset: C
						}),
						o === "general" && /* @__PURE__ */ (0, x.jsx)(pe, { ...T })
					]
				}, o)]
			})
		]
	});
}
//#endregion
//#region src/react/WorkflowPage.jsx
var Ce = ({ path: e, size: t = 16, strokeWidth: n = 2, ...r }) => /* @__PURE__ */ (0, x.jsx)("svg", {
	width: t,
	height: t,
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: n,
	strokeLinecap: "round",
	strokeLinejoin: "round",
	...r,
	children: Array.isArray(e) ? e.map((e, t) => /* @__PURE__ */ (0, x.jsx)("path", { d: e }, t)) : /* @__PURE__ */ (0, x.jsx)("path", { d: e })
}), we = {
	report: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8",
	log: "M4 6h16M4 12h16M4 18h10",
	copy: "M9 9h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2zM5 15H4a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1",
	clear: "M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
}, Te = [
	{
		id: "tokens",
		valueId: "wfMetric_totalTokens",
		subId: "wfMetricSub_totalTokens",
		title: "Total Tokens",
		value: "0",
		icon: ["M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"]
	},
	{
		id: "cost",
		valueId: "wfMetric_totalCost",
		subId: "wfMetricSub_totalCost",
		title: "Total Cost",
		value: "$0.0000",
		icon: ["M12 1v22", "M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"]
	},
	{
		id: "latency",
		valueId: "wfMetric_latency",
		subId: "wfMetricSub_latency",
		title: "Latency (P95)",
		value: "0.00s",
		icon: ["M12 22A10 10 0 1 0 12 2a10 10 0 0 0 0 20z", "M12 6v6l4 2"]
	},
	{
		id: "cacheHitRate",
		valueId: "wfMetric_cacheHitRate",
		subId: "wfMetricSub_cacheHitRate",
		title: "Cache Hit Rate",
		value: "0%",
		icon: ["M23 4v6h-6", "M20.49 15a9 9 0 1 1-2.12-9.36L23 10"]
	},
	{
		id: "cache",
		valueId: "wfMetric_cache",
		subId: "wfMetricSub_cache",
		title: "Cache",
		value: "HIT / MISS",
		icon: [
			"M12 8c5 0 9-1.34 9-3s-4-3-9-3-9 1.34-9 3 4 3 9 3z",
			"M21 12c0 1.66-4 3-9 3s-9-1.34-9-3",
			"M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"
		]
	},
	{
		id: "successRate",
		valueId: "wfMetric_successRate",
		subId: "wfMetricSub_successRate",
		title: "Success Rate",
		value: "100%",
		icon: ["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"]
	}
], Ee = [
	{
		id: "overview",
		label: "סקירה"
	},
	{
		id: "filters",
		label: "פילטר"
	},
	{
		id: "events",
		label: "אירועים"
	},
	{
		id: "logs",
		label: "לוגים"
	},
	{
		id: "metrics",
		label: "מדדים"
	}
];
function De({ m: e }) {
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		className: "metricCard",
		id: `metricCard_${e.id}`,
		children: [/* @__PURE__ */ (0, x.jsx)("span", {
			className: "metricIcon",
			children: /* @__PURE__ */ (0, x.jsx)(Ce, {
				path: e.icon,
				size: 18
			})
		}), /* @__PURE__ */ (0, x.jsxs)("div", {
			className: "metricContent",
			children: [
				/* @__PURE__ */ (0, x.jsx)("span", {
					className: "metricTitle",
					children: e.title
				}),
				/* @__PURE__ */ (0, x.jsx)("strong", {
					className: "metricValue",
					id: e.valueId,
					children: e.value
				}),
				/* @__PURE__ */ (0, x.jsx)("span", {
					className: "metricSub",
					id: e.subId,
					children: "—"
				})
			]
		})]
	});
}
function Oe() {
	return (0, b.useEffect)(() => {
		window.__bidocWorkflowMounted = !0;
		let e = 0, t = null, n = () => {
			if (typeof window.__bidocInitWorkflow == "function") {
				window.__bidocInitWorkflow();
				return;
			}
			e++ < 60 && (t = setTimeout(n, 50));
		};
		return n(), () => {
			t && clearTimeout(t);
		};
	}, []), /* @__PURE__ */ (0, x.jsxs)("div", {
		className: "wfShell",
		dir: "rtl",
		children: [/* @__PURE__ */ (0, x.jsxs)("header", {
			className: "wfHeader",
			children: [/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "wfHeaderTitle",
				children: [/* @__PURE__ */ (0, x.jsx)("h2", { children: "זרימת עבודה" }), /* @__PURE__ */ (0, x.jsx)("p", {
					className: "wfHeaderSub",
					children: "תצוגת הרכיבים, הקווים והלוגים של ההרצה האחרונה — בזמן אמת."
				})]
			}), /* @__PURE__ */ (0, x.jsxs)("div", {
				className: "wfHeaderActions",
				children: [
					/* @__PURE__ */ (0, x.jsxs)("button", {
						id: "runAiReport",
						type: "button",
						className: "wfBtn wfBtnPrimary",
						children: [/* @__PURE__ */ (0, x.jsx)(Ce, {
							path: we.report,
							size: 15
						}), " דוח AI"]
					}),
					/* @__PURE__ */ (0, x.jsxs)("button", {
						id: "toggleFullLog",
						type: "button",
						className: "wfBtn",
						children: [/* @__PURE__ */ (0, x.jsx)(Ce, {
							path: we.log,
							size: 15
						}), " לוג מלא"]
					}),
					/* @__PURE__ */ (0, x.jsxs)("button", {
						id: "copyLog",
						type: "button",
						className: "wfBtn",
						children: [/* @__PURE__ */ (0, x.jsx)(Ce, {
							path: we.copy,
							size: 15
						}), " העתק"]
					}),
					/* @__PURE__ */ (0, x.jsxs)("button", {
						id: "clearWorkflow",
						type: "button",
						className: "wfBtn wfBtnDanger",
						children: [/* @__PURE__ */ (0, x.jsx)(Ce, {
							path: we.clear,
							size: 15
						}), " נקה"]
					})
				]
			})]
		}), /* @__PURE__ */ (0, x.jsxs)("div", {
			className: "workflowLayout",
			children: [/* @__PURE__ */ (0, x.jsxs)("aside", {
				className: "runHistoryStrip",
				id: "runHistoryStrip",
				children: [/* @__PURE__ */ (0, x.jsx)("div", {
					className: "runHistoryStripHeader",
					children: "היסטוריית ריצות"
				}), /* @__PURE__ */ (0, x.jsx)("div", {
					className: "runHistoryList",
					id: "runHistoryList",
					children: /* @__PURE__ */ (0, x.jsx)("div", {
						className: "runHistoryEmpty",
						children: "אין ריצות שמורות"
					})
				})]
			}), /* @__PURE__ */ (0, x.jsxs)("div", {
				className: "workflowMain",
				children: [
					/* @__PURE__ */ (0, x.jsxs)("section", {
						className: "liveRun collapsed",
						id: "liveRun",
						children: [
							/* @__PURE__ */ (0, x.jsxs)("header", {
								id: "liveRunHeader",
								style: {
									cursor: "pointer",
									userSelect: "none"
								},
								children: [/* @__PURE__ */ (0, x.jsxs)("div", {
									style: {
										display: "flex",
										alignItems: "center",
										gap: 8
									},
									children: [/* @__PURE__ */ (0, x.jsx)("svg", {
										id: "liveRunChevron",
										width: "14",
										height: "14",
										viewBox: "0 0 24 24",
										fill: "none",
										stroke: "currentColor",
										strokeWidth: "2.5",
										strokeLinecap: "round",
										strokeLinejoin: "round",
										style: {
											transition: "transform 0.2s",
											flexShrink: 0
										},
										children: /* @__PURE__ */ (0, x.jsx)("polyline", { points: "9 18 15 12 9 6" })
									}), /* @__PURE__ */ (0, x.jsx)("strong", { children: "לוג ריצה חי" })]
								}), /* @__PURE__ */ (0, x.jsx)("span", {
									id: "liveRunStatus",
									children: "ממתין לבקשה"
								})]
							}),
							/* @__PURE__ */ (0, x.jsx)("div", {
								className: "liveRunList",
								id: "liveRunList"
							}),
							/* @__PURE__ */ (0, x.jsx)("pre", {
								className: "fullLogView",
								id: "fullLogView",
								hidden: !0
							})
						]
					}),
					/* @__PURE__ */ (0, x.jsx)("section", {
						className: "workflowMetricCards",
						id: "workflowMetricCards",
						hidden: !0,
						children: Te.map((e) => /* @__PURE__ */ (0, x.jsx)(De, { m: e }, e.id))
					}),
					/* @__PURE__ */ (0, x.jsxs)("section", {
						className: "openRouterMetrics",
						id: "openRouterMetrics",
						hidden: !0,
						"aria-hidden": "true",
						children: [
							/* @__PURE__ */ (0, x.jsx)("span", {
								id: "openRouterCalls",
								children: "0"
							}),
							/* @__PURE__ */ (0, x.jsx)("span", {
								id: "openRouterInputTokens",
								children: "0"
							}),
							/* @__PURE__ */ (0, x.jsx)("span", {
								id: "openRouterOutputTokens",
								children: "0"
							}),
							/* @__PURE__ */ (0, x.jsx)("span", {
								id: "openRouterCost",
								children: "$0.0000"
							}),
							/* @__PURE__ */ (0, x.jsx)("span", {
								id: "openRouterSpeed",
								children: "—"
							})
						]
					}),
					/* @__PURE__ */ (0, x.jsx)("div", {
						className: "workflowHint",
						id: "workflowHint",
						children: "שלח הודעה בצ׳אט כדי לראות את רכיבי המערכת, הקווים ביניהם והלוגים של ההרצה האחרונה."
					}),
					/* @__PURE__ */ (0, x.jsxs)("div", {
						className: "workflowToolbar",
						id: "workflowToolbar",
						hidden: !0,
						children: [
							/* @__PURE__ */ (0, x.jsxs)("div", {
								className: "workflowSearchGroup",
								children: [/* @__PURE__ */ (0, x.jsx)("input", {
									id: "workflowSearch",
									type: "search",
									placeholder: "Search node, input, output",
									autoComplete: "off"
								}), /* @__PURE__ */ (0, x.jsxs)("select", {
									id: "workflowStatusFilter",
									"aria-label": "Filter workflow status",
									children: [
										/* @__PURE__ */ (0, x.jsx)("option", {
											value: "",
											children: "All statuses"
										}),
										/* @__PURE__ */ (0, x.jsx)("option", {
											value: "done",
											children: "Done"
										}),
										/* @__PURE__ */ (0, x.jsx)("option", {
											value: "error",
											children: "Error"
										}),
										/* @__PURE__ */ (0, x.jsx)("option", {
											value: "skipped",
											children: "Skipped"
										})
									]
								})]
							}),
							/* @__PURE__ */ (0, x.jsxs)("div", {
								className: "workflowToolGroup",
								children: [
									/* @__PURE__ */ (0, x.jsx)("button", {
										id: "workflowErrorsOnly",
										type: "button",
										title: "Show errors only",
										children: "Errors"
									}),
									/* @__PURE__ */ (0, x.jsx)("button", {
										id: "workflowSlowNodes",
										type: "button",
										title: "Highlight slow nodes",
										children: "Slow"
									}),
									/* @__PURE__ */ (0, x.jsx)("button", {
										id: "workflowExpensiveNodes",
										type: "button",
										title: "Highlight expensive nodes",
										children: "Cost"
									}),
									/* @__PURE__ */ (0, x.jsx)("button", {
										id: "workflowFallbackNodes",
										type: "button",
										title: "Highlight fallback route",
										children: "Fallback"
									}),
									/* @__PURE__ */ (0, x.jsx)("button", {
										id: "workflowRegressionNodes",
										type: "button",
										title: "Highlight regressions",
										children: "Regressions"
									}),
									/* @__PURE__ */ (0, x.jsx)("button", {
										id: "clearWorkflowCompare",
										type: "button",
										title: "Clear run comparison",
										hidden: !0,
										children: "Clear Compare"
									}),
									/* @__PURE__ */ (0, x.jsx)("button", {
										id: "fitWorkflow",
										type: "button",
										title: "Fit to screen",
										children: "Fit"
									}),
									/* @__PURE__ */ (0, x.jsx)("button", {
										id: "toggleWorkflowCards",
										type: "button",
										title: "Expand or collapse node cards",
										children: "Collapse"
									}),
									/* @__PURE__ */ (0, x.jsx)("button", {
										id: "resetWorkflowFilters",
										type: "button",
										title: "Reset workflow filters",
										children: "Reset"
									})
								]
							}),
							/* @__PURE__ */ (0, x.jsx)("div", {
								className: "workflowIssueSummary",
								id: "workflowIssueSummary",
								children: "0 matches"
							})
						]
					}),
					/* @__PURE__ */ (0, x.jsx)("div", {
						className: "workflowCompareSummary",
						id: "workflowCompareSummary",
						hidden: !0
					}),
					/* @__PURE__ */ (0, x.jsx)("div", {
						className: "workflowBoard",
						id: "workflowBoard",
						children: /* @__PURE__ */ (0, x.jsx)("div", { id: "workflowCy" })
					}),
					/* @__PURE__ */ (0, x.jsxs)("div", {
						className: "workflowBottomPanel",
						id: "workflowBottomPanel",
						hidden: !0,
						children: [/* @__PURE__ */ (0, x.jsxs)("div", {
							className: "workflowBottomTabBar",
							children: [/* @__PURE__ */ (0, x.jsx)("div", {
								className: "workflowBottomTabs",
								children: Ee.map((e, t) => /* @__PURE__ */ (0, x.jsx)("button", {
									className: `bottomTab${t === 0 ? " active" : ""}`,
									"data-bottom-tab": e.id,
									children: e.label
								}, e.id))
							}), /* @__PURE__ */ (0, x.jsxs)("button", {
								id: "wfExportBtn",
								className: "wfExportBtn",
								type: "button",
								children: [/* @__PURE__ */ (0, x.jsx)(Ce, {
									path: [
										"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",
										"M7 10l5 5 5-5",
										"M12 15V3"
									],
									size: 14,
									strokeWidth: 2.2
								}), "יצוא ריצה"]
							})]
						}), /* @__PURE__ */ (0, x.jsxs)("div", {
							className: "workflowBottomTabContent",
							children: [
								/* @__PURE__ */ (0, x.jsx)("div", {
									className: "bottomTabPane active",
									id: "wfPane_overview",
									children: /* @__PURE__ */ (0, x.jsxs)("table", {
										className: "wfOverviewTable",
										children: [/* @__PURE__ */ (0, x.jsx)("thead", { children: /* @__PURE__ */ (0, x.jsxs)("tr", { children: [
											/* @__PURE__ */ (0, x.jsx)("th", { children: "Run ID" }),
											/* @__PURE__ */ (0, x.jsx)("th", { children: "Started At" }),
											/* @__PURE__ */ (0, x.jsx)("th", { children: "Duration" }),
											/* @__PURE__ */ (0, x.jsx)("th", { children: "Status" }),
											/* @__PURE__ */ (0, x.jsx)("th", { children: "Model" }),
											/* @__PURE__ */ (0, x.jsx)("th", { children: "Environment" }),
											/* @__PURE__ */ (0, x.jsx)("th", { children: "Workflow Version" })
										] }) }), /* @__PURE__ */ (0, x.jsx)("tbody", { children: /* @__PURE__ */ (0, x.jsxs)("tr", { children: [
											/* @__PURE__ */ (0, x.jsx)("td", {
												id: "wfOverview_runId",
												children: "—"
											}),
											/* @__PURE__ */ (0, x.jsx)("td", {
												id: "wfOverview_startedAt",
												children: "—"
											}),
											/* @__PURE__ */ (0, x.jsx)("td", {
												id: "wfOverview_duration",
												children: "—"
											}),
											/* @__PURE__ */ (0, x.jsx)("td", {
												id: "wfOverview_status",
												children: "—"
											}),
											/* @__PURE__ */ (0, x.jsx)("td", {
												id: "wfOverview_model",
												children: "—"
											}),
											/* @__PURE__ */ (0, x.jsx)("td", {
												id: "wfOverview_environment",
												children: "—"
											}),
											/* @__PURE__ */ (0, x.jsx)("td", {
												id: "wfOverview_version",
												children: "—"
											})
										] }) })]
									})
								}),
								/* @__PURE__ */ (0, x.jsx)("div", {
									className: "bottomTabPane",
									id: "wfPane_filters",
									hidden: !0,
									children: /* @__PURE__ */ (0, x.jsx)("div", {
										className: "panePlaceholder",
										children: "תוכן פילטרים זמין דרך סרגל הכלים העליון."
									})
								}),
								/* @__PURE__ */ (0, x.jsx)("div", {
									className: "bottomTabPane",
									id: "wfPane_events",
									hidden: !0,
									children: /* @__PURE__ */ (0, x.jsx)("div", {
										className: "panePlaceholder",
										children: "בחר רכיב בגרף כדי לראות אירועים רלוונטיים."
									})
								}),
								/* @__PURE__ */ (0, x.jsx)("div", {
									className: "bottomTabPane",
									id: "wfPane_logs",
									hidden: !0,
									children: /* @__PURE__ */ (0, x.jsx)("div", {
										className: "panePlaceholder",
										children: "לוג ריצה מלא זמין דרך כפתור \"לוג מלא\" למעלה."
									})
								}),
								/* @__PURE__ */ (0, x.jsx)("div", {
									className: "bottomTabPane",
									id: "wfPane_metrics",
									hidden: !0,
									children: /* @__PURE__ */ (0, x.jsx)("div", {
										className: "panePlaceholder",
										children: "מדדי ביצוע מפורטים זמינים בפאנל הפירוט של הרכיבים."
									})
								})
							]
						})]
					}),
					/* @__PURE__ */ (0, x.jsx)("aside", {
						className: "workflowInspector",
						id: "workflowInspector",
						children: /* @__PURE__ */ (0, x.jsx)("div", {
							className: "workflowInspectorEmpty",
							children: "בחר רכיב בגרף כדי לראות Input / Output."
						})
					}),
					/* @__PURE__ */ (0, x.jsxs)("section", {
						className: "workflowAiReport",
						id: "workflowAiReport",
						hidden: !0,
						children: [/* @__PURE__ */ (0, x.jsxs)("header", { children: [/* @__PURE__ */ (0, x.jsx)("strong", { children: "דוח AI" }), /* @__PURE__ */ (0, x.jsx)("span", {
							id: "workflowAiReportStatus",
							children: "ממתין להרצה"
						})] }), /* @__PURE__ */ (0, x.jsx)("div", { id: "workflowAiReportBody" })]
					})
				]
			})]
		})]
	});
}
//#endregion
//#region src/react/InsightsPage.jsx
var ke = "2024-02-01", Ae = "2026-01-01", je = 350, Me = ({ path: e, size: t = 16, strokeWidth: n = 2, ...r }) => /* @__PURE__ */ (0, x.jsx)("svg", {
	width: t,
	height: t,
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: n,
	strokeLinecap: "round",
	strokeLinejoin: "round",
	...r,
	children: Array.isArray(e) ? e.map((e, t) => /* @__PURE__ */ (0, x.jsx)("path", { d: e }, t)) : /* @__PURE__ */ (0, x.jsx)("path", { d: e })
}), Ne = {
	spark: ["M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6L12 3z", "M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16z"],
	refresh: [
		"M23 4v6h-6",
		"M1 20v-6h6",
		"M3.5 9a9 9 0 0 1 14.8-3.5L23 10",
		"M1 14l4.7 4.5A9 9 0 0 0 20.5 15"
	],
	play: "M5 3l14 9-14 9V3z",
	plus: "M12 5v14M5 12h14",
	history: [
		"M12 8v5l3 2",
		"M3 12a9 9 0 1 0 3-6.7",
		"M3 3v6h6"
	],
	chart: [
		"M3 3v18h18",
		"M8 17V9",
		"M13 17V6",
		"M18 17v-4"
	],
	check: "M20 6L9 17l-5-5",
	alert: "M10.3 3.3L1.5 18A2 2 0 0 0 3.2 21h17.6a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01",
	workflow: [
		"M18 18a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
		"M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
		"M13 6h3a2 2 0 0 1 2 2v4",
		"M6 9v7a2 2 0 0 0 2 2h7"
	],
	chevron: "M9 18l6-6-6-6"
};
async function Pe(e, t = {}) {
	let { timeoutMs: n = 3e4, ...r } = t, i = new AbortController(), a = setTimeout(() => i.abort(), n);
	try {
		let t = await fetch(e, {
			headers: {
				"Content-Type": "application/json",
				...r.headers || {}
			},
			...r,
			body: r.body && typeof r.body != "string" ? JSON.stringify(r.body) : r.body,
			signal: i.signal
		}), n = await t.text(), a = n ? JSON.parse(n) : {};
		if (!t.ok) throw Error(a?.error || a?.message || `HTTP ${t.status}`);
		return a;
	} finally {
		clearTimeout(a);
	}
}
function Fe(e) {
	return [...new Set((e || []).filter(Boolean))];
}
function Ie(e = {}, t = !1) {
	let n = Array.isArray(e.findings) ? e.findings : Array.isArray(e.metadata?.findings) ? e.metadata.findings : [];
	return n.length ? n : t ? (Array.isArray(e.insights) ? e.insights : []).map((e, t) => ({
		id: e.id || `legacy_${t + 1}`,
		title: e.title || "ממצא",
		category: e.category,
		severity: e.severity,
		confidence: e.confidence,
		finding: e.finding || e.insight || e.summary || "",
		why_it_matters: e.why_it_matters,
		recommended_action: e.recommended_action,
		evidence: e.evidence || e.sources || []
	})) : [];
}
function Le(e = {}) {
	let t = Array.isArray(e.insights) ? e.insights : [];
	return t.length ? Array.isArray(e.findings) || Array.isArray(e.metadata?.findings) ? t : t.filter((e) => Array.isArray(e?.supporting_finding_ids) && e.supporting_finding_ids.length) : [];
}
function Re(e, t) {
	if (!e || e.ok === !1) return t;
	let n = Ie(e, !0), r = Ie(t), i = Le(e), a = Le(t);
	return {
		...t,
		summary: {
			...t.summary || {},
			totalRecords: Number(e.summary?.totalRecords || 0) + Number(t.summary?.totalRecords || 0),
			expandedRuns: Number(e.summary?.expandedRuns || 1) + 1
		},
		findings: ze([...n, ...r]),
		insights: ze([...i, ...a]),
		workflowLog: t.workflowLog || e.workflowLog
	};
}
function ze(e = []) {
	let t = /* @__PURE__ */ new Set(), n = [];
	for (let r of e) {
		let e = String(r.id || r.title || r.finding || r.insight || JSON.stringify(r)).slice(0, 180);
		t.has(e) || (t.add(e), n.push(r));
	}
	return n;
}
function Be(e = {}) {
	let t = e.metadata || {}, n = {
		...e,
		metadata: t
	};
	return {
		ok: e.status !== "error",
		error: e.error || "",
		runId: e.run_id || e.runId || "",
		summary: {
			...t.summary || {},
			focusQuery: e.focus_query || t.summary?.focusQuery || "",
			dateFrom: e.date_from || t.summary?.dateFrom || "",
			dateTo: e.date_to || t.summary?.dateTo || "",
			totalRecords: e.scanned_count || t.summary?.totalRecords || 0
		},
		insights: Le(n),
		findings: Ie(n, !0),
		workflowLog: e.workflow_log || t.workflowLog || null,
		scannedSourceKeys: e.scanned_source_keys || t.scannedSourceKeys || [],
		healthScore: t.healthScore || e.healthScore,
		trends: t.trends || e.trends,
		rootCauseHypotheses: t.rootCauseHypotheses || e.rootCauseHypotheses
	};
}
function Ve(e) {
	return {
		blocker: "חסם",
		decision: "החלטה",
		missing_info: "מידע חסר",
		repeated_topic: "נושא חוזר",
		commercial: "מסחרי",
		quality_safety: "איכות/בטיחות",
		entity: "ישות"
	}[e] || e || "כללי";
}
function He(e) {
	return {
		high: "גבוה",
		medium: "בינוני",
		low: "נמוך"
	}[e] || e || "בינוני";
}
function Ue(e) {
	if (!e) return "";
	let t = Date.now() - new Date(e).getTime();
	if (!Number.isFinite(t)) return "";
	let n = Math.max(1, Math.round(t / 6e4));
	if (n < 60) return `לפני ${n} דק׳`;
	let r = Math.round(n / 60);
	return r < 24 ? `לפני ${r} שעות` : `לפני ${Math.round(r / 24)} ימים`;
}
function We(e = {}) {
	let t = e.evidence || e.sources || e.records || e.evidence_records || [];
	return Array.isArray(t) ? t.slice(0, 5) : [];
}
function Ge() {
	let [e, t] = (0, b.useState)(""), [n, r] = (0, b.useState)(ke), [i, a] = (0, b.useState)(Ae), [o, s] = (0, b.useState)(je), [c, l] = (0, b.useState)({
		crossWindowTrend: !1,
		rootCauseHypotheses: !1,
		healthScore: !1,
		graphClustering: !1
	}), [u, d] = (0, b.useState)("alerts"), [f, p] = (0, b.useState)(!1), [m, h] = (0, b.useState)([]), [g, _] = (0, b.useState)([]), [v, y] = (0, b.useState)([]), [S, C] = (0, b.useState)(!1), [w, T] = (0, b.useState)(""), [E, ee] = (0, b.useState)(null), [D, te] = (0, b.useState)(!1), [O, k] = (0, b.useState)({
		state: "idle",
		text: "מוכן להרצת סוכן התובנות"
	}), [A, j] = (0, b.useState)([]), [M, N] = (0, b.useState)([]), [P, F] = (0, b.useState)(0), I = (0, b.useRef)(null), ne = (0, b.useRef)(null), re = (0, b.useMemo)(() => {
		let e = m.slice(0, 30);
		return f ? [...e].sort((e, t) => String(e.tag).localeCompare(String(t.tag), "he")) : e;
	}, [m, f]), ie = (0, b.useMemo)(() => Math.max(...re.map((e) => Number(e.count || 0)), 1), [re]), L = (0, b.useMemo)(() => Le(E || {}), [E]), R = (0, b.useMemo)(() => Ie(E || {}, !0), [E]), ae = !!(E && E.ok !== !1 && (M.length || E.scannedSourceKeys?.length)), oe = (0, b.useCallback)(async (e = {}) => {
		let t = e.source || u, r = new URLSearchParams();
		n && r.set("date_from", n), i && r.set("date_to", i), r.set("source", t);
		let a = await Pe(`/api/insights/hashtags?${r}`, { timeoutMs: 15e3 });
		h(Array.isArray(a.hashtags) ? a.hashtags : []), d(t);
	}, [
		u,
		n,
		i
	]), z = (0, b.useCallback)(async () => {
		let e = await Pe("/api/insights/runs?limit=30", { timeoutMs: 2e4 });
		y(Array.isArray(e.runs) ? e.runs : []);
	}, []);
	(0, b.useEffect)(() => {
		oe().catch((e) => k({
			state: "error",
			text: `לא ניתן לטעון האשטגים: ${e.message}`
		}));
	}, [oe]), (0, b.useEffect)(() => {
		z().catch(() => {});
	}, [z]), (0, b.useEffect)(() => () => {
		I.current && I.current.close();
	}, []);
	function se(e) {
		l((t) => ({
			...t,
			[e]: !t[e]
		}));
	}
	function ce(e) {
		_((t) => t.includes(e) ? t.filter((t) => t !== e) : [...t, e]);
	}
	function le(e) {
		I.current && I.current.close(), j([]);
		try {
			let t = new EventSource(`/api/runs/${encodeURIComponent(e)}/events`);
			t.addEventListener("log", (e) => {
				try {
					let t = JSON.parse(e.data);
					if (t.step === "complete" || t.step === "error") return;
					let n = ot(t);
					j((e) => e[e.length - 1] === n ? e : [...e, n]);
				} catch {}
			}), t.onerror = () => {}, I.current = t;
		} catch {
			I.current = null;
		}
	}
	async function ue({ expansion: t = !1 } = {}) {
		if (D) return;
		te(!0);
		let r = t ? M : [], a = `project_insights_${Date.now()}_${Math.random().toString(16).slice(2)}`;
		k({
			state: "running",
			text: t ? `מרחיב תשובה ומדלג על ${r.length.toLocaleString()} מקורות שכבר נותחו...` : "מריץ ניתוח על נתוני האינדקס..."
		}), t || (ee(null), N([]), F(0), T("")), le(a);
		try {
			let s = await Pe("/api/insights/analyze", {
				method: "POST",
				timeoutMs: 9e5,
				body: {
					runId: a,
					focusQuery: e,
					dateFrom: n || null,
					dateTo: i || null,
					limit: Number(o || je),
					selectedHashtags: g,
					hashtagMode: "boost",
					insights: Object.fromEntries(Object.entries(c).filter(([, e]) => e)),
					excludeSourceKeys: r,
					expansion: t,
					parentRunId: t && (E?.runId || w) || null
				}
			}), l = t ? Re(E, s) : s;
			ee(l), N((e) => Fe([...e, ...s.scannedSourceKeys || []])), F((e) => e + 1), T(l?.runId || s.runId || ""), k({
				state: "done",
				text: "ניתוח התובנות הסתיים"
			}), window.__bidocSetWorkflowFromReact?.(s), await z().catch(() => {}), setTimeout(() => ne.current?.scrollIntoView({
				behavior: "smooth",
				block: "start"
			}), 120);
		} catch (e) {
			ee(t && E ? {
				...E,
				expansionError: e.message
			} : {
				ok: !1,
				error: e.message
			}), k({
				state: "error",
				text: `ניתוח התובנות נכשל: ${e.message}`
			});
		} finally {
			I.current && I.current.close(), I.current = null, te(!1);
		}
	}
	function de(e) {
		let n = Be(e);
		ee(n), T(n.runId), N(Array.isArray(e.scanned_source_keys) ? e.scanned_source_keys : n.scannedSourceKeys || []), F(Number(n.summary?.expandedRuns || e.metadata?.runCount || (e.is_expansion ? 2 : 1) || 1)), t(e.focus_query || n.summary?.focusQuery || ""), (e.date_from || n.summary?.dateFrom) && r(e.date_from || n.summary.dateFrom), (e.date_to || n.summary?.dateTo) && a(e.date_to || n.summary.dateTo), e.source_limit && s(Number(e.source_limit)), k({
			state: "done",
			text: "דוח תובנות נטען מההיסטוריה"
		}), window.__bidocSetWorkflowFromReact?.(n);
	}
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		className: "reactInsights",
		dir: "rtl",
		children: [
			/* @__PURE__ */ (0, x.jsxs)("header", {
				className: "riHero",
				children: [/* @__PURE__ */ (0, x.jsxs)("div", {
					className: "riHeroMain",
					children: [
						/* @__PURE__ */ (0, x.jsxs)("span", {
							className: "riEyebrow",
							children: [/* @__PURE__ */ (0, x.jsx)(Me, {
								path: Ne.spark,
								size: 14
							}), " Project Intelligence"]
						}),
						/* @__PURE__ */ (0, x.jsx)("h2", { children: "סוכן תובנות" }),
						/* @__PURE__ */ (0, x.jsx)("p", { children: "מסך עבודה לריצות עומק על אינדקס הפרויקט: איתור חסמים, החלטות פתוחות, ישויות משפיעות, מגמות וסיכונים עם ראיות." })
					]
				}), /* @__PURE__ */ (0, x.jsxs)("div", {
					className: "riHeroStats",
					children: [
						/* @__PURE__ */ (0, x.jsx)(Ke, {
							label: "ריצות שמורות",
							value: v.length || "0"
						}),
						/* @__PURE__ */ (0, x.jsx)(Ke, {
							label: "האשטגים פעילים",
							value: g.length || "0"
						}),
						/* @__PURE__ */ (0, x.jsx)(Ke, {
							label: "מקורות בסריקה",
							value: Number(o || 0).toLocaleString()
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, x.jsxs)("section", {
				className: "riCommand",
				children: [
					/* @__PURE__ */ (0, x.jsxs)("div", {
						className: "riCommandGrid",
						children: [
							/* @__PURE__ */ (0, x.jsxs)("label", {
								className: "riField riFieldWide",
								children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "מיקוד אופציונלי" }), /* @__PURE__ */ (0, x.jsx)("input", {
									value: e,
									onChange: (e) => t(e.target.value),
									onKeyDown: (e) => {
										e.key === "Enter" && (e.ctrlKey || e.metaKey) && (e.preventDefault(), ue({ expansion: e.shiftKey }));
									},
									placeholder: "לדוגמה: חסמים בפרויקט, אישורים פתוחים, עלויות חריגות"
								})]
							}),
							/* @__PURE__ */ (0, x.jsxs)("label", {
								className: "riField",
								children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "מתאריך" }), /* @__PURE__ */ (0, x.jsx)("input", {
									type: "date",
									value: n,
									onChange: (e) => r(e.target.value)
								})]
							}),
							/* @__PURE__ */ (0, x.jsxs)("label", {
								className: "riField",
								children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "עד תאריך" }), /* @__PURE__ */ (0, x.jsx)("input", {
									type: "date",
									value: i,
									onChange: (e) => a(e.target.value)
								})]
							}),
							/* @__PURE__ */ (0, x.jsxs)("label", {
								className: "riField",
								children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "כמות מקורות" }), /* @__PURE__ */ (0, x.jsxs)("select", {
									value: o,
									onChange: (e) => s(Number(e.target.value)),
									children: [
										/* @__PURE__ */ (0, x.jsx)("option", {
											value: "200",
											children: "200"
										}),
										/* @__PURE__ */ (0, x.jsx)("option", {
											value: "350",
											children: "350"
										}),
										/* @__PURE__ */ (0, x.jsx)("option", {
											value: "700",
											children: "700"
										})
									]
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, x.jsxs)("div", {
						className: "riEngineRow",
						children: [
							/* @__PURE__ */ (0, x.jsx)("span", { children: "מנועי עומק" }),
							/* @__PURE__ */ (0, x.jsx)(qe, {
								checked: c.crossWindowTrend,
								onClick: () => se("crossWindowTrend"),
								label: "מגמות"
							}),
							/* @__PURE__ */ (0, x.jsx)(qe, {
								checked: c.rootCauseHypotheses,
								onClick: () => se("rootCauseHypotheses"),
								label: "סיבת שורש"
							}),
							/* @__PURE__ */ (0, x.jsx)(qe, {
								checked: c.healthScore,
								onClick: () => se("healthScore"),
								label: "ציון בריאות"
							}),
							/* @__PURE__ */ (0, x.jsx)(qe, {
								checked: c.graphClustering,
								onClick: () => se("graphClustering"),
								label: "גרף"
							})
						]
					}),
					/* @__PURE__ */ (0, x.jsxs)("div", {
						className: "riActionRow",
						children: [
							/* @__PURE__ */ (0, x.jsxs)("button", {
								className: "riBtn riBtnPrimary",
								disabled: D,
								onClick: () => ue(),
								children: [
									/* @__PURE__ */ (0, x.jsx)(Me, {
										path: Ne.play,
										size: 15
									}),
									" ",
									D ? "מנתח..." : "נתח את הפרויקט"
								]
							}),
							/* @__PURE__ */ (0, x.jsxs)("button", {
								className: "riBtn",
								disabled: D || !ae,
								onClick: () => ue({ expansion: !0 }),
								children: [/* @__PURE__ */ (0, x.jsx)(Me, {
									path: Ne.plus,
									size: 15
								}), " הרחב תשובה"]
							}),
							/* @__PURE__ */ (0, x.jsxs)("button", {
								className: "riBtn",
								onClick: () => oe().catch((e) => k({
									state: "error",
									text: e.message
								})),
								children: [/* @__PURE__ */ (0, x.jsx)(Me, {
									path: Ne.refresh,
									size: 15
								}), " רענן האשטגים"]
							}),
							/* @__PURE__ */ (0, x.jsx)("span", {
								className: "riShortcut",
								children: "Ctrl+Enter להרצה · Ctrl+Shift+Enter להרחבה"
							})
						]
					})
				]
			}),
			/* @__PURE__ */ (0, x.jsxs)("section", {
				className: "riSplit",
				children: [/* @__PURE__ */ (0, x.jsx)(Je, {
					hashtags: re,
					max: ie,
					selected: g,
					source: u,
					sortAlpha: f,
					onToggleTag: ce,
					onSource: (e) => oe({ source: e }).catch((e) => k({
						state: "error",
						text: e.message
					})),
					onSort: p,
					onClear: () => _([])
				}), /* @__PURE__ */ (0, x.jsx)(Ye, {
					history: v,
					open: S,
					selectedRunId: w,
					onToggle: () => C((e) => !e),
					onRefresh: () => z().catch((e) => k({
						state: "error",
						text: e.message
					})),
					onSelect: de
				})]
			}),
			/* @__PURE__ */ (0, x.jsx)(Xe, {
				status: O,
				liveSteps: A,
				result: E,
				runCount: P,
				scannedKeys: M,
				insights: L,
				findings: R
			}),
			/* @__PURE__ */ (0, x.jsx)("section", {
				className: "riResults",
				ref: ne,
				children: D && !E ? /* @__PURE__ */ (0, x.jsx)(at, {}) : /* @__PURE__ */ (0, x.jsx)(Ze, {
					result: E,
					insights: L,
					findings: R
				})
			})
		]
	});
}
function Ke({ label: e, value: t }) {
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		className: "riMetric",
		children: [/* @__PURE__ */ (0, x.jsx)("span", { children: e }), /* @__PURE__ */ (0, x.jsx)("strong", { children: t })]
	});
}
function qe({ checked: e, onClick: t, label: n }) {
	return /* @__PURE__ */ (0, x.jsxs)("button", {
		type: "button",
		className: "riToggle",
		"aria-pressed": e,
		onClick: t,
		children: [/* @__PURE__ */ (0, x.jsx)("span", { "aria-hidden": "true" }), n]
	});
}
function Je({ hashtags: e, max: t, selected: n, source: r, sortAlpha: i, onToggleTag: a, onSource: o, onSort: s, onClear: c }) {
	return /* @__PURE__ */ (0, x.jsxs)("section", {
		className: "riPanel riHashtags",
		children: [
			/* @__PURE__ */ (0, x.jsxs)("header", { children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsxs)("span", {
				className: "riEyebrow",
				children: [/* @__PURE__ */ (0, x.jsx)(Me, {
					path: Ne.chart,
					size: 13
				}), " Hashtag Analytics"]
			}), /* @__PURE__ */ (0, x.jsx)("h3", { children: "אותות חוזרים באינדקס" })] }), /* @__PURE__ */ (0, x.jsxs)("div", {
				className: "riSegment",
				children: [/* @__PURE__ */ (0, x.jsx)("button", {
					"aria-pressed": r === "alerts",
					onClick: () => o("alerts"),
					children: "Alerts"
				}), /* @__PURE__ */ (0, x.jsx)("button", {
					"aria-pressed": r === "index",
					onClick: () => o("index"),
					children: "אינדקס"
				})]
			})] }),
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "riChartControls",
				children: [
					/* @__PURE__ */ (0, x.jsx)("button", {
						className: "riMiniBtn",
						"aria-pressed": i,
						onClick: () => s(!0),
						children: "א-ב"
					}),
					/* @__PURE__ */ (0, x.jsx)("button", {
						className: "riMiniBtn",
						"aria-pressed": !i,
						onClick: () => s(!1),
						children: "כמות"
					}),
					n.length ? /* @__PURE__ */ (0, x.jsx)("button", {
						className: "riMiniBtn",
						onClick: c,
						children: "נקה בחירה"
					}) : /* @__PURE__ */ (0, x.jsx)("span", { children: "לחץ על תגית כדי לחזק אותה בניתוח הבא" })
				]
			}),
			/* @__PURE__ */ (0, x.jsx)("div", {
				className: "riSelectedTags",
				children: n.length ? n.map((e) => /* @__PURE__ */ (0, x.jsxs)("button", {
					onClick: () => a(e),
					children: [
						"#",
						e,
						" ×"
					]
				}, e)) : /* @__PURE__ */ (0, x.jsx)("span", { children: "אין תגיות נבחרות" })
			}),
			/* @__PURE__ */ (0, x.jsx)("div", {
				className: "riBars",
				children: e.length ? e.map((e) => /* @__PURE__ */ (0, x.jsxs)("button", {
					className: "riBar",
					"data-selected": n.includes(e.tag) ? "true" : "false",
					onClick: () => a(e.tag),
					children: [
						/* @__PURE__ */ (0, x.jsxs)("span", { children: ["#", e.tag] }),
						/* @__PURE__ */ (0, x.jsx)("i", { style: { "--bar": `${Math.max(5, Number(e.count || 0) / t * 100)}%` } }),
						/* @__PURE__ */ (0, x.jsx)("b", { children: Number(e.count || 0).toLocaleString() })
					]
				}, e.tag)) : /* @__PURE__ */ (0, x.jsx)("div", {
					className: "riEmpty",
					children: "אין נתוני האשטגים לטווח הנבחר."
				})
			})
		]
	});
}
function Ye({ history: e, open: t, selectedRunId: n, onToggle: r, onRefresh: i, onSelect: a }) {
	return /* @__PURE__ */ (0, x.jsxs)("section", {
		className: "riPanel riHistory",
		"data-open": t ? "true" : "false",
		children: [/* @__PURE__ */ (0, x.jsxs)("header", { children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsxs)("span", {
			className: "riEyebrow",
			children: [/* @__PURE__ */ (0, x.jsx)(Me, {
				path: Ne.history,
				size: 13
			}), " Run History"]
		}), /* @__PURE__ */ (0, x.jsx)("h3", { children: "היסטוריית תובנות" })] }), /* @__PURE__ */ (0, x.jsxs)("div", {
			className: "riHistoryActions",
			children: [/* @__PURE__ */ (0, x.jsx)("button", {
				className: "riMiniBtn",
				onClick: r,
				"aria-expanded": t,
				children: t ? "הסתר" : `הצג (${e.length})`
			}), /* @__PURE__ */ (0, x.jsx)("button", {
				className: "riMiniBtn",
				onClick: i,
				children: "רענן"
			})]
		})] }), t && /* @__PURE__ */ (0, x.jsx)("div", {
			className: "riHistoryList",
			children: e.length ? e.map((e) => {
				let t = Be(e);
				return /* @__PURE__ */ (0, x.jsxs)("button", {
					className: "riHistoryItem",
					"aria-pressed": n && n === t.runId,
					onClick: () => a(e),
					children: [
						/* @__PURE__ */ (0, x.jsx)("strong", { children: e.focus_query || t.summary?.focusQuery || "סריקה כללית" }),
						/* @__PURE__ */ (0, x.jsxs)("span", { children: [
							t.insights.length,
							" תובנות · ",
							t.findings.length,
							" ממצאים · ",
							Number(e.scanned_count || t.summary?.totalRecords || 0).toLocaleString(),
							" מקורות"
						] }),
						/* @__PURE__ */ (0, x.jsxs)("small", { children: [
							e.status === "error" ? "שגיאה" : e.is_expansion ? "הרחבה" : "ריצה",
							" · ",
							Ue(e.created_at)
						] })
					]
				}, t.runId || e.created_at);
			}) : /* @__PURE__ */ (0, x.jsx)("div", {
				className: "riEmpty",
				children: "אין עדיין ריצות שמורות."
			})
		})]
	});
}
function Xe({ status: e, liveSteps: t, result: n, runCount: r, scannedKeys: i, insights: a, findings: o }) {
	let s = n?.summary || {}, c = i.length || n?.scannedSourceKeys?.length || Number(s.totalRecords || 0);
	return /* @__PURE__ */ (0, x.jsxs)("section", {
		className: "riStatus",
		"data-state": e.state,
		children: [
			/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("strong", { children: e.text }), n && n.ok !== !1 && /* @__PURE__ */ (0, x.jsxs)("span", { children: [
				Number(s.totalRecords || 0).toLocaleString(),
				" מקורות · ",
				a.length,
				" תובנות · ",
				o.length,
				" ממצאים · ",
				r || s.expandedRuns || 1,
				" ריצות"
			] })] }),
			n?.workflowLog && /* @__PURE__ */ (0, x.jsxs)("button", {
				className: "riMiniBtn",
				onClick: () => window.__bidocActivateTab?.("workflow"),
				children: [/* @__PURE__ */ (0, x.jsx)(Me, {
					path: Ne.workflow,
					size: 13
				}), " פתח Workflow"]
			}),
			!n && c > 0 && /* @__PURE__ */ (0, x.jsxs)("span", { children: [c.toLocaleString(), " מקורות נסרקו"] }),
			t.length > 0 && /* @__PURE__ */ (0, x.jsx)("div", {
				className: "riLiveSteps",
				children: t.slice(-7).map((e, n) => /* @__PURE__ */ (0, x.jsxs)("span", {
					className: n === t.slice(-7).length - 1 ? "active" : "done",
					children: [n === t.slice(-7).length - 1 ? /* @__PURE__ */ (0, x.jsx)("i", { className: "progressSpinner" }) : /* @__PURE__ */ (0, x.jsx)(Me, {
						path: Ne.check,
						size: 11
					}), e]
				}, `${e}_${n}`))
			})
		]
	});
}
function Ze({ result: e, insights: t, findings: n }) {
	if (!e) return /* @__PURE__ */ (0, x.jsxs)("div", {
		className: "riWelcome",
		children: [
			/* @__PURE__ */ (0, x.jsx)("span", { children: /* @__PURE__ */ (0, x.jsx)(Me, {
				path: Ne.spark,
				size: 22
			}) }),
			/* @__PURE__ */ (0, x.jsx)("h3", { children: "הרץ ניתוח AI על נתוני הפרויקט" }),
			/* @__PURE__ */ (0, x.jsx)("p", { children: "הסוכן יסרוק את האינדקס, יחבר ממצאים לדפוסים, ויציג תובנות עם פעולה מומלצת וראיות." })
		]
	});
	if (e.ok === !1) return /* @__PURE__ */ (0, x.jsxs)("div", {
		className: "riError",
		children: [
			/* @__PURE__ */ (0, x.jsx)(Me, {
				path: Ne.alert,
				size: 18
			}),
			" ",
			e.error || "ניתוח התובנות נכשל."
		]
	});
	let r = /* @__PURE__ */ (0, x.jsx)(Qe, { result: e });
	if (!t.length && !n.length && !e.healthScore && !e.trends && !e.rootCauseHypotheses) return /* @__PURE__ */ (0, x.jsx)("div", {
		className: "riEmpty",
		children: "לא נמצאו אותות מספיק חזקים בסריקה הזו. אפשר להרחיב תשובה כדי לסרוק מקורות נוספים."
	});
	let i = new Set(t.flatMap((e) => e.supporting_finding_ids || []).map(String)), a = n.filter((e) => !i.has(String(e.id || "")));
	return /* @__PURE__ */ (0, x.jsxs)(x.Fragment, { children: [
		r,
		/* @__PURE__ */ (0, x.jsxs)("section", {
			className: "riResultSection",
			children: [/* @__PURE__ */ (0, x.jsxs)("header", { children: [/* @__PURE__ */ (0, x.jsx)("h3", { children: "תובנות AI" }), /* @__PURE__ */ (0, x.jsxs)("span", { children: [t.length, " תובנות מסונתזות"] })] }), t.length ? /* @__PURE__ */ (0, x.jsx)("div", {
				className: "riInsightGrid",
				children: t.map((e, t) => /* @__PURE__ */ (0, x.jsx)(nt, {
					insight: e,
					findings: n
				}, e.id || e.title || t))
			}) : /* @__PURE__ */ (0, x.jsx)("div", {
				className: "riEmpty",
				children: "נמצאו ממצאים, אבל אין עדיין חיבור מספיק חזק ביניהם כדי לקרוא לזה תובנה."
			})]
		}),
		a.length > 0 && /* @__PURE__ */ (0, x.jsxs)("section", {
			className: "riResultSection",
			children: [/* @__PURE__ */ (0, x.jsxs)("header", { children: [/* @__PURE__ */ (0, x.jsx)("h3", { children: "ממצאים שלא הפכו לתובנה" }), /* @__PURE__ */ (0, x.jsxs)("span", { children: [a.length, " ממצאים"] })] }), /* @__PURE__ */ (0, x.jsx)("div", {
				className: "riFindingsList",
				children: a.map((e, t) => /* @__PURE__ */ (0, x.jsx)(rt, { finding: e }, e.id || t))
			})]
		})
	] });
}
function Qe({ result: e }) {
	let t = [];
	return e.healthScore && t.push(/* @__PURE__ */ (0, x.jsx)($e, { health: e.healthScore }, "health")), Array.isArray(e.trends?.metrics) && e.trends.metrics.length && t.push(/* @__PURE__ */ (0, x.jsx)(et, { trends: e.trends }, "trends")), Array.isArray(e.rootCauseHypotheses) && e.rootCauseHypotheses.length && t.push(/* @__PURE__ */ (0, x.jsx)(tt, { hypotheses: e.rootCauseHypotheses }, "hypotheses")), t.length ? /* @__PURE__ */ (0, x.jsx)("section", {
		className: "riEnginePanels",
		children: t
	}) : null;
}
function $e({ health: e = {} }) {
	let t = e.dimensions || e.subscores || {};
	return /* @__PURE__ */ (0, x.jsxs)("article", {
		className: "riEnginePanel",
		children: [
			/* @__PURE__ */ (0, x.jsxs)("header", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "Executive Health" }), /* @__PURE__ */ (0, x.jsx)("h4", { children: e.score ?? "N/A" })] }),
			/* @__PURE__ */ (0, x.jsx)("div", {
				className: "riHealthRows",
				children: Object.entries(t).map(([e, t]) => {
					let n = typeof t == "object" ? t.score : t;
					return /* @__PURE__ */ (0, x.jsxs)("div", {
						className: "riHealthRow",
						children: [
							/* @__PURE__ */ (0, x.jsx)("span", { children: e }),
							/* @__PURE__ */ (0, x.jsx)("i", { style: { "--bar": `${Number(n || 0)}%` } }),
							/* @__PURE__ */ (0, x.jsx)("b", { children: n ?? "—" })
						]
					}, e);
				})
			}),
			Array.isArray(e.critical_flags) && e.critical_flags.length > 0 && /* @__PURE__ */ (0, x.jsx)("p", { children: e.critical_flags.join(" · ") })
		]
	});
}
function et({ trends: e = {} }) {
	return /* @__PURE__ */ (0, x.jsxs)("article", {
		className: "riEnginePanel",
		children: [/* @__PURE__ */ (0, x.jsxs)("header", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "Previous Window" }), /* @__PURE__ */ (0, x.jsx)("h4", { children: "מגמות" })] }), /* @__PURE__ */ (0, x.jsx)("div", {
			className: "riTrendRows",
			children: e.metrics.slice(0, 6).map((e) => /* @__PURE__ */ (0, x.jsxs)("div", {
				"data-tone": e.assessment === "worse" ? "bad" : e.assessment === "better" ? "good" : "neutral",
				children: [
					/* @__PURE__ */ (0, x.jsx)("span", { children: e.label || e.metric }),
					/* @__PURE__ */ (0, x.jsxs)("small", { children: [
						e.current ?? "—",
						" ← ",
						e.baseline ?? "—"
					] }),
					/* @__PURE__ */ (0, x.jsx)("b", { children: e.direction || e.assessment || "stable" })
				]
			}, e.metric || e.name))
		})]
	});
}
function tt({ hypotheses: e = [] }) {
	return /* @__PURE__ */ (0, x.jsxs)("article", {
		className: "riEnginePanel",
		children: [/* @__PURE__ */ (0, x.jsxs)("header", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "Requires Validation" }), /* @__PURE__ */ (0, x.jsx)("h4", { children: "השערות סיבת שורש" })] }), /* @__PURE__ */ (0, x.jsx)("div", {
			className: "riHypotheses",
			children: e.slice(0, 4).map((e, t) => /* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("b", { children: e.title || e.hypothesis || "השערה לבדיקה" }), /* @__PURE__ */ (0, x.jsx)("p", { children: e.hypothesis || e.rationale || e.summary })] }, e.id || t))
		})]
	});
}
function nt({ insight: e, findings: t }) {
	let [n, r] = (0, b.useState)(!1), i = (e.supporting_finding_ids || []).map((e) => t.find((t) => String(t.id || "") === String(e))).filter(Boolean);
	return /* @__PURE__ */ (0, x.jsxs)("article", {
		className: "riInsightCard",
		"data-severity": e.severity || "medium",
		children: [
			/* @__PURE__ */ (0, x.jsxs)("header", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: Ve(e.category) }), /* @__PURE__ */ (0, x.jsx)("b", { children: He(e.severity) })] }),
			/* @__PURE__ */ (0, x.jsx)("h4", { children: e.title || "תובנה" }),
			/* @__PURE__ */ (0, x.jsx)("p", { children: e.insight || e.finding || e.summary }),
			e.why_it_matters && /* @__PURE__ */ (0, x.jsx)(it, {
				title: "למה זה חשוב",
				text: e.why_it_matters
			}),
			e.recommended_action && /* @__PURE__ */ (0, x.jsx)(it, {
				title: "פעולה מומלצת",
				text: e.recommended_action
			}),
			e.uncertainty && /* @__PURE__ */ (0, x.jsx)(it, {
				title: "אי ודאות",
				text: e.uncertainty
			}),
			i.length > 0 && /* @__PURE__ */ (0, x.jsxs)("div", {
				className: "riSupporting",
				children: [/* @__PURE__ */ (0, x.jsxs)("button", {
					onClick: () => r((e) => !e),
					children: [
						/* @__PURE__ */ (0, x.jsx)(Me, {
							path: Ne.chevron,
							size: 13
						}),
						" ",
						n ? "הסתר ממצאים" : `${i.length} ממצאים תומכים`
					]
				}), n && i.map((e, t) => /* @__PURE__ */ (0, x.jsx)(rt, {
					finding: e,
					compact: !0
				}, e.id || t))]
			})
		]
	});
}
function rt({ finding: e, compact: t = !1 }) {
	let n = We(e);
	return /* @__PURE__ */ (0, x.jsxs)("article", {
		className: "riFindingCard",
		"data-compact": t ? "true" : "false",
		"data-severity": e.severity || "medium",
		children: [
			/* @__PURE__ */ (0, x.jsxs)("header", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: Ve(e.category) }), /* @__PURE__ */ (0, x.jsx)("b", { children: He(e.severity) })] }),
			/* @__PURE__ */ (0, x.jsx)("h4", { children: e.title || "ממצא" }),
			/* @__PURE__ */ (0, x.jsx)("p", { children: e.finding || e.insight || e.summary }),
			!t && e.recommended_action && /* @__PURE__ */ (0, x.jsx)(it, {
				title: "פעולה מומלצת",
				text: e.recommended_action
			}),
			n.length > 0 && /* @__PURE__ */ (0, x.jsxs)("details", {
				className: "riEvidence",
				children: [/* @__PURE__ */ (0, x.jsxs)("summary", { children: [n.length, " ראיות"] }), n.map((e, t) => /* @__PURE__ */ (0, x.jsx)("p", { children: typeof e == "string" ? e : e.summary || e.text || e.title || JSON.stringify(e) }, t))]
			})
		]
	});
}
function it({ title: e, text: t }) {
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		className: "riInfoLine",
		children: [/* @__PURE__ */ (0, x.jsx)("b", { children: e }), /* @__PURE__ */ (0, x.jsx)("span", { children: t })]
	});
}
function at() {
	return /* @__PURE__ */ (0, x.jsxs)("section", {
		className: "riResultSection",
		children: [/* @__PURE__ */ (0, x.jsxs)("header", { children: [/* @__PURE__ */ (0, x.jsx)("h3", { children: "תובנות AI" }), /* @__PURE__ */ (0, x.jsx)("span", { children: "מנתח..." })] }), /* @__PURE__ */ (0, x.jsxs)("div", {
			className: "riInsightGrid",
			children: [
				/* @__PURE__ */ (0, x.jsx)("div", { className: "insightSkeleton" }),
				/* @__PURE__ */ (0, x.jsx)("div", { className: "insightSkeleton" }),
				/* @__PURE__ */ (0, x.jsx)("div", { className: "insightSkeleton" })
			]
		})]
	});
}
function ot(e = {}) {
	return {
		index_scan: "סורק אינדקס",
		alert_direction: "מנתח התראות",
		hashtag_analysis: "מנתח האשטגים",
		focus_retrieval: "מרחיב אחזור",
		graph_enrichment: "מעשיר גרף",
		graph_search: "מחפש קשרים",
		evidence_pipeline: "מזקק ראיות",
		closure_followup: "בודק סגירות",
		ai_synthesis: "מסנתז תובנות",
		insight_critic: "מבקר תובנות",
		insight_ranking: "מדרג תובנות",
		health_score: "מחשב בריאות"
	}[e.step] || e.label || e.message || e.step || "מעבד";
}
//#endregion
//#region src/react/SchedulePage.jsx
var st = {
	on_track: "בזמן",
	watch: "במעקב",
	at_risk: "בסיכון",
	delayed_vs_contractor: "באיחור מול לוח הקבלן",
	delayed_vs_contract: "באיחור מול החוזה",
	milestone_at_risk: "אבן דרך בסיכון",
	milestone_delayed: "אבן דרך באיחור",
	hidden_slippage: "דחיית לו\"ז שקטה",
	completed_late: "הושלמה באיחור",
	completed_on_time: "הושלמה בזמן",
	insufficient_data: "נתונים חסרים",
	source_conflict: "סתירה בין מקורות",
	not_started: "טרם החלה",
	blocked: "חסומה"
}, ct = {
	on_track: "ok",
	completed_on_time: "ok",
	watch: "watch",
	at_risk: "warn",
	milestone_at_risk: "warn",
	hidden_slippage: "warn",
	completed_late: "warn",
	delayed_vs_contractor: "bad",
	delayed_vs_contract: "bad",
	milestone_delayed: "bad",
	blocked: "bad",
	source_conflict: "conflict",
	insufficient_data: "unknown",
	not_started: "idle"
}, lt = {
	contract_finish: "החוזה",
	contractor_planned_finish: "לוח הקבלן",
	forecast_finish: "תחזית"
}, ut = {
	contractAxis: "ציר חוזי",
	scheduleVersions: "גרסאות לוח",
	dependencies: "תלויות",
	observedEvents: "אירועי שטח",
	calendar: "לוח שנה"
}, dt = [
	"ינו",
	"פבר",
	"מרץ",
	"אפר",
	"מאי",
	"יוני",
	"יולי",
	"אוג",
	"ספט",
	"אוק",
	"נוב",
	"דצמ"
], ft = 120;
async function pt(e, { method: t = "GET", body: n = null, timeoutMs: r = 12e4 } = {}) {
	let i = new AbortController(), a = setTimeout(() => i.abort(), r);
	try {
		let r = await fetch(e, {
			method: t,
			headers: n ? { "Content-Type": "application/json" } : void 0,
			body: n ? JSON.stringify(n) : void 0,
			signal: i.signal
		}), a = await r.json().catch(() => ({}));
		if (!r.ok) throw Error(a.error || `HTTP ${r.status}`);
		return a;
	} finally {
		clearTimeout(a);
	}
}
function mt(e) {
	if (!e) return "—";
	if (e.daysLate != null) {
		let t = e.workingDaysLate == null ? "" : ` (${e.workingDaysLate} ימי עבודה)`;
		return `באיחור ${e.daysLate} ימים${t}`;
	}
	if (e.daysRemaining != null) {
		if (e.daysRemaining === 0) return "היום";
		let t = e.workingDaysRemaining == null ? "" : ` (${e.workingDaysRemaining} ימי עבודה)`;
		return `נותרו ${e.daysRemaining} ימים${t}`;
	}
	return "—";
}
function ht(e) {
	return !e?.basis || !e?.basisDate ? "ללא בסיס" : `מול ${lt[e.basis] ?? e.basis}: ${e.basisDate}`;
}
var gt = ({ status: e }) => /* @__PURE__ */ (0, x.jsx)("span", {
	className: `schedBadge schedTone-${ct[e] ?? "unknown"}`,
	children: st[e] ?? e
}), _t = ({ confidence: e }) => {
	if (!e) return null;
	let t = e.level ?? "low", n = t === "high" ? "ביטחון גבוה" : t === "medium" ? "ביטחון בינוני" : "ביטחון נמוך";
	return /* @__PURE__ */ (0, x.jsxs)("span", {
		className: `schedBadge schedConf-${t}`,
		title: `ציון: ${e.score}`,
		children: [t === "low" ? "⚠ " : "", n]
	});
}, vt = ({ gates: e, compact: t = !1 }) => e ? /* @__PURE__ */ (0, x.jsxs)("div", {
	className: `schedGates ${t ? "is-compact" : ""}`,
	children: [!t && /* @__PURE__ */ (0, x.jsx)("span", {
		className: "schedGatesTitle",
		children: "מה נבדק:"
	}), Object.entries(ut).map(([t, n]) => {
		let r = e[t], i = r === "ok" || t === "scheduleVersions" && Number(r) > 1, a = t === "scheduleVersions" ? `${n}: ${r}` : n;
		return /* @__PURE__ */ (0, x.jsxs)("span", {
			className: `schedGate ${i ? "is-ok" : r === "stale" ? "is-stale" : "is-missing"}`,
			title: r === "missing" ? "לא זמין — לא נבדק, לא נלקח בחשבון" : r === "stale" ? "קיים אך לא מעודכן" : "נבדק",
			children: [
				i ? "✓" : r === "stale" ? "◐" : "✗",
				" ",
				a
			]
		}, t);
	})]
}) : null;
function yt(e, t) {
	let n = Infinity, r = -Infinity, i = (e) => {
		if (!e) return;
		let t = Date.parse(`${e}T00:00:00Z`);
		Number.isNaN(t) || (t < n && (n = t), t > r && (r = t));
	};
	i(t);
	for (let t of e) {
		let e = t.timing ?? {};
		i(e.plannedStart), i(e.plannedFinish), i(e.contractFinish), i(e.observedStart), i(e.observedFinish);
	}
	if (!Number.isFinite(n) || !Number.isFinite(r) || n === r) return null;
	let a = (r - n) * .03;
	n -= a, r += a;
	let o = (e) => {
		let t = Date.parse(`${e}T00:00:00Z`);
		return Number.isNaN(t) ? null : Math.min(100, Math.max(0, (t - n) / (r - n) * 100));
	}, s = [], c = new Date(n);
	for (c.setUTCDate(1); c.getTime() <= r;) {
		let e = c.toISOString().slice(0, 10), t = o(e);
		t != null && s.push({
			iso: e,
			left: t,
			label: `${dt[c.getUTCMonth()]} ${String(c.getUTCFullYear()).slice(2)}`
		}), c.setUTCMonth(c.getUTCMonth() + 1);
	}
	return {
		pos: o,
		months: s
	};
}
var bt = () => /* @__PURE__ */ (0, x.jsxs)("div", {
	className: "axisLegend",
	children: [
		/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("i", { className: "axisSwatch swPlan" }), " תכנון הקבלן"] }),
		/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("i", { className: "axisSwatch swFill" }), " % ביצוע מדווח"] }),
		/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("i", { className: "axisSwatch swLate" }), " חריגה עד \"נכון ל-\""] }),
		/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("i", {
			className: "axisSwatch swForecast",
			children: "◆"
		}), " תחזית סיום"] }),
		/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("i", {
			className: "axisSwatch swContract",
			children: "⚑"
		}), " אבן דרך חוזית"] }),
		/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("i", { className: "axisSwatch swObserved" }), " ביצוע נצפה (BIDoc)"] }),
		/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("i", { className: "axisSwatch swToday" }), " קו \"נכון ל-\""] })
	]
});
function xt({ indicator: e, scale: t, asOf: n, selected: r, onSelect: i }) {
	let a = e.timing ?? {}, o = e.lateness ?? {}, s = t.pos(a.plannedStart), c = t.pos(a.plannedFinish), l = t.pos(a.contractFinish), u = t.pos(a.forecastFinish), d = t.pos(a.observedStart), f = t.pos(a.observedFinish), p = t.pos(o.basisDate), m = t.pos(n), h = a.percentComplete, g = o.isLate === !0;
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		className: `axisRow ${r ? "is-selected" : ""}`,
		onClick: () => i(e),
		children: [/* @__PURE__ */ (0, x.jsxs)("div", {
			className: "axisTrack",
			dir: "ltr",
			children: [
				/* @__PURE__ */ (0, x.jsx)("div", {
					className: "axisLane",
					children: l == null ? null : /* @__PURE__ */ (0, x.jsx)("span", {
						className: "axisContractFlag",
						style: { left: `${l}%` },
						title: `מועד חוזי: ${a.contractFinish}`,
						children: "⚑"
					})
				}),
				/* @__PURE__ */ (0, x.jsxs)("div", {
					className: "axisLane",
					children: [s != null && c != null && /* @__PURE__ */ (0, x.jsx)("div", {
						className: `axisBarPlan ${e.subject.isMilestone ? "is-milestone" : ""}`,
						style: {
							left: `${s}%`,
							width: `${Math.max(c - s, .6)}%`
						},
						title: `תכנון: ${a.plannedStart} → ${a.plannedFinish}`,
						children: h != null && h > 0 ? /* @__PURE__ */ (0, x.jsx)("div", {
							className: "axisBarFill",
							style: { width: `${h}%` },
							title: `${h}% ביצוע מדווח`
						}) : null
					}), g && p != null && m != null && m > p && /* @__PURE__ */ (0, x.jsx)("div", {
						className: "axisBarLate",
						style: {
							left: `${p}%`,
							width: `${m - p}%`
						},
						title: `${mt(o)} — ${ht(o)}`
					})]
				}),
				/* @__PURE__ */ (0, x.jsx)("div", {
					className: "axisLane",
					children: d != null || f != null ? /* @__PURE__ */ (0, x.jsx)("div", {
						className: "axisBarObserved",
						style: {
							left: `${d ?? f}%`,
							width: `${Math.max((f ?? d) - (d ?? f), .6)}%`
						},
						title: `ביצוע נצפה: ${a.observedStart ?? "?"} → ${a.observedFinish ?? "?"}`
					}) : u == null ? null : /* @__PURE__ */ (0, x.jsx)("span", {
						className: "axisForecast",
						style: { left: `${u}%` },
						title: `תחזית סיום: ${a.forecastFinish}`,
						children: "◆"
					})
				})
			]
		}), /* @__PURE__ */ (0, x.jsxs)("div", {
			className: "axisName",
			children: [/* @__PURE__ */ (0, x.jsxs)("span", {
				className: "axisNameText",
				title: e.subject.name,
				children: [e.subject.isMilestone ? "◆ " : "", e.subject.name]
			}), /* @__PURE__ */ (0, x.jsxs)("span", {
				className: "axisNameMeta",
				children: [/* @__PURE__ */ (0, x.jsx)(gt, { status: e.status }), /* @__PURE__ */ (0, x.jsx)("span", {
					className: "axisLateText",
					children: mt(o)
				})]
			})]
		})]
	});
}
function St({ indicators: e, allIndicators: t, asOf: n, selected: r, onSelect: i }) {
	let a = (0, b.useMemo)(() => yt(e, n), [e, n]), o = (0, b.useMemo)(() => {
		let n = /* @__PURE__ */ new Map();
		for (let r of t ?? e) {
			let e = r.timing?.contractFinish;
			!e || n.has(e) || n.set(e, {
				date: e,
				name: r.subject?.milestoneKey ? r.subject.name : "אבן דרך חוזית"
			});
		}
		return [...n.values()];
	}, [e, t]);
	if (!a) return /* @__PURE__ */ (0, x.jsx)("div", {
		className: "schedEmpty",
		children: "אין תאריכים להצגה"
	});
	let s = e.slice(0, ft), c = a.pos(n);
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		className: "axesView",
		children: [
			/* @__PURE__ */ (0, x.jsx)(bt, {}),
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "axesBody",
				children: [/* @__PURE__ */ (0, x.jsxs)("div", {
					className: "axesTimeArea",
					dir: "ltr",
					children: [/* @__PURE__ */ (0, x.jsx)("div", {
						className: "axesMonths",
						children: a.months.map((e) => /* @__PURE__ */ (0, x.jsx)("span", {
							className: "axesMonthTick",
							style: { left: `${e.left}%` },
							children: e.label
						}, e.iso))
					}), /* @__PURE__ */ (0, x.jsxs)("div", {
						className: "axesRowsOverlay",
						children: [
							a.months.map((e) => /* @__PURE__ */ (0, x.jsx)("span", {
								className: "axesGridLine",
								style: { left: `${e.left}%` }
							}, e.iso)),
							o.map((e) => {
								let t = a.pos(e.date);
								return t == null ? null : /* @__PURE__ */ (0, x.jsx)("span", {
									className: "axesContractLine",
									style: { left: `${t}%` },
									children: /* @__PURE__ */ (0, x.jsxs)("label", { children: [
										"⚑ ",
										e.name,
										" · ",
										e.date
									] })
								}, e.date);
							}),
							c != null && /* @__PURE__ */ (0, x.jsx)("span", {
								className: "axesTodayLine",
								style: { left: `${c}%` },
								children: /* @__PURE__ */ (0, x.jsxs)("label", { children: ["נכון ל-", n] })
							})
						]
					})]
				}), /* @__PURE__ */ (0, x.jsx)("div", {
					className: "axesRows",
					children: s.map((e) => /* @__PURE__ */ (0, x.jsx)(xt, {
						indicator: e,
						scale: a,
						asOf: n,
						selected: r?.subject.activityKey === e.subject.activityKey,
						onSelect: i
					}, e.subject.activityKey))
				})]
			}),
			e.length > ft ? /* @__PURE__ */ (0, x.jsxs)("div", {
				className: "axesCapNote",
				children: [
					"מוצגות ",
					ft,
					" הפעילויות החמורות מתוך ",
					e.length,
					" — צמצם עם הפילטרים למעלה"
				]
			}) : null
		]
	});
}
var Ct = ({ indicator: e, onClose: t }) => {
	if (!e) return null;
	let n = e.timing ?? {}, r = e.variances ?? {};
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		className: "schedDetail",
		children: [
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "schedDetailHead",
				children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [
					/* @__PURE__ */ (0, x.jsx)(gt, { status: e.status }),
					/* @__PURE__ */ (0, x.jsx)(_t, { confidence: e.confidence }),
					e.severity != null && /* @__PURE__ */ (0, x.jsxs)("span", {
						className: "schedBadge schedSeverity",
						children: ["חומרה ", e.severity]
					})
				] }), /* @__PURE__ */ (0, x.jsx)("button", {
					type: "button",
					className: "schedClose",
					onClick: t,
					children: "✕"
				})]
			}),
			/* @__PURE__ */ (0, x.jsx)("h3", {
				className: "schedDetailTitle",
				children: e.subject?.name
			}),
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "schedDetailMeta",
				children: [
					mt(e.lateness),
					" · ",
					ht(e.lateness)
				]
			}),
			/* @__PURE__ */ (0, x.jsx)("p", {
				className: "schedExplanation",
				children: e.explanation
			}),
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "schedTimingGrid",
				children: [
					/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "התחלה מתוכננת" }), /* @__PURE__ */ (0, x.jsx)("b", { children: n.plannedStart ?? "—" })] }),
					/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "סיום מתוכנן" }), /* @__PURE__ */ (0, x.jsx)("b", { children: n.plannedFinish ?? "—" })] }),
					/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "סיום חוזי" }), /* @__PURE__ */ (0, x.jsx)("b", { children: n.contractFinish ?? "—" })] }),
					/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "תחזית סיום" }), /* @__PURE__ */ (0, x.jsx)("b", { children: n.forecastFinish ?? "—" })] }),
					/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "סיום בפועל" }), /* @__PURE__ */ (0, x.jsx)("b", { children: n.observedFinish ?? "—" })] }),
					/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "% ביצוע" }), /* @__PURE__ */ (0, x.jsx)("b", { children: n.percentComplete ?? "—" })] }),
					/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "סטייה מגרסה קודמת" }), /* @__PURE__ */ (0, x.jsx)("b", { children: r.contractorVersionSlippageDays == null ? "—" : `${r.contractorVersionSlippageDays} ימים` })] }),
					/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "Float נותר" }), /* @__PURE__ */ (0, x.jsx)("b", { children: r.remainingFloatDays == null ? "— (אין נתוני תלויות)" : `${r.remainingFloatDays} ימים` })] })
				]
			}),
			/* @__PURE__ */ (0, x.jsx)(vt, { gates: e.gates }),
			e.evidence?.length ? /* @__PURE__ */ (0, x.jsxs)("div", {
				className: "schedEvidence",
				children: [/* @__PURE__ */ (0, x.jsx)("div", {
					className: "schedGatesTitle",
					children: "ראיות:"
				}), e.evidence.map((e) => /* @__PURE__ */ (0, x.jsxs)("div", {
					className: "schedEvidenceRow",
					children: [
						/* @__PURE__ */ (0, x.jsx)("span", {
							className: "schedEvidenceKind",
							children: e.kind
						}),
						/* @__PURE__ */ (0, x.jsx)("span", { children: e.excerpt }),
						e.eventDate ? /* @__PURE__ */ (0, x.jsx)("span", {
							className: "schedEvidenceDate",
							children: e.eventDate
						}) : null
					]
				}, e.evidenceId))]
			}) : null
		]
	});
}, wt = {
	execution: "ביצוע",
	payment: "תשלומים",
	notice: "הודעות",
	guarantee: "ערבויות",
	insurance: "ביטוחים",
	warranty: "בדק ואחריות",
	other: "אחר"
}, Tt = {
	hours: "שעות",
	working_days: "ימי עבודה",
	calendar_days: "ימים",
	weeks: "שבועות",
	months: "חודשים"
}, Et = {
	event: "אירוע נכנס",
	schedule_task: "נקודה בלוח הקבלן",
	milestone: "אבן דרך אחרת",
	unspecified: "לא הוגדר"
};
function Dt(e) {
	if (e.offset_value == null) return "ללא כימות";
	let t = Tt[e.offset_unit] ?? e.offset_unit ?? "";
	return `${Number(e.offset_value)} ${t}`.trim();
}
var Ot = ({ data: e, expanded: t, onToggle: n, resolvingId: r, onResolve: i, rowResults: a }) => {
	let o = e?.conditions ?? [];
	if (!o.length) return null;
	let s = Object.entries(o.reduce((e, t) => ((e[t.category] ||= []).push(t), e), {}));
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		className: "condBox",
		children: [/* @__PURE__ */ (0, x.jsxs)("button", {
			type: "button",
			className: "condHead",
			onClick: n,
			children: [
				/* @__PURE__ */ (0, x.jsxs)("span", {
					className: "condHeadTitle",
					children: ["⏳ אבני דרך הממתינות לטריגר", /* @__PURE__ */ (0, x.jsx)("span", {
						className: "condHeadCount",
						children: o.length
					})]
				}),
				/* @__PURE__ */ (0, x.jsx)("span", {
					className: "condHeadHint",
					children: "התחייבויות יחסיות מהחוזה — יקבלו תאריך ויעלו על ציר הזמן ברגע שהאירוע המפעיל ייקלט"
				}),
				/* @__PURE__ */ (0, x.jsx)("span", {
					className: "condChevron",
					children: t ? "▲" : "▼"
				})
			]
		}), t ? /* @__PURE__ */ (0, x.jsxs)("div", {
			className: "condBody",
			children: [/* @__PURE__ */ (0, x.jsx)("div", {
				className: "condResolverBar",
				children: /* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("strong", { children: "סוכן איתור תאריכים" }), /* @__PURE__ */ (0, x.jsx)("span", { children: "כל כפתור מפעיל חיפוש נפרד שמוגבל להתניה, לאירוע ולתאריך של אותה שורה בלבד." })] })
			}), s.map(([e, t]) => /* @__PURE__ */ (0, x.jsxs)("div", {
				className: "condGroup",
				children: [/* @__PURE__ */ (0, x.jsxs)("div", {
					className: "condGroupTitle",
					children: [wt[e] ?? e, /* @__PURE__ */ (0, x.jsx)("span", {
						className: "condGroupCount",
						children: t.length
					})]
				}), /* @__PURE__ */ (0, x.jsx)("div", {
					className: "condTableWrap",
					children: /* @__PURE__ */ (0, x.jsxs)("table", {
						className: "condTable",
						children: [/* @__PURE__ */ (0, x.jsx)("thead", { children: /* @__PURE__ */ (0, x.jsxs)("tr", { children: [
							/* @__PURE__ */ (0, x.jsx)("th", { children: "אבן הדרך" }),
							/* @__PURE__ */ (0, x.jsx)("th", { children: "הכלל החוזי" }),
							/* @__PURE__ */ (0, x.jsx)("th", { children: "סוג הטריגר" }),
							/* @__PURE__ */ (0, x.jsx)("th", { children: "מקור" }),
							/* @__PURE__ */ (0, x.jsx)("th", { children: "פעולה" })
						] }) }), /* @__PURE__ */ (0, x.jsx)("tbody", { children: t.map((e) => {
							let t = a?.[e.id], n = r === e.id;
							return /* @__PURE__ */ (0, x.jsxs)("tr", {
								title: e.source_excerpt,
								children: [
									/* @__PURE__ */ (0, x.jsx)("td", {
										className: "condName",
										children: e.name
									}),
									/* @__PURE__ */ (0, x.jsxs)("td", {
										className: "condRule",
										children: [
											/* @__PURE__ */ (0, x.jsx)("b", { children: Dt(e) }),
											" מ־",
											e.anchor_description
										]
									}),
									/* @__PURE__ */ (0, x.jsx)("td", { children: /* @__PURE__ */ (0, x.jsx)("span", {
										className: `condAnchor is-${e.anchor_kind}`,
										children: Et[e.anchor_kind] ?? e.anchor_kind
									}) }),
									/* @__PURE__ */ (0, x.jsx)("td", {
										className: "condPage",
										children: e.source_page ? `עמ׳ ${e.source_page}` : "—"
									}),
									/* @__PURE__ */ (0, x.jsxs)("td", {
										className: "condActionCell",
										children: [/* @__PURE__ */ (0, x.jsx)("button", {
											type: "button",
											className: "condResolveBtn",
											onClick: () => i(e),
											disabled: !!r,
											children: n ? "סוכן AI מחפש…" : "חפש והשלם עם AI"
										}), t ? /* @__PURE__ */ (0, x.jsxs)("span", {
											className: `condRowResult is-${t.status}`,
											title: t.reason || t.evidence?.reason || "",
											children: [t.status === "not_found" ? "לא נמצא תאריך" : t.status === "needs_review" ? "נדרשת בדיקה" : t.status === "error" ? t.reason || "החיפוש נכשל" : t.dueDate || "הושלם", t.errorCode === "openrouter_auth" ? /* @__PURE__ */ (0, x.jsx)("a", {
												className: "condSettingsLink",
												href: "#settings",
												children: "עדכון מפתח בהגדרות"
											}) : null]
										}) : null]
									})
								]
							}, e.id);
						}) })]
					})
				})]
			}, e))]
		}) : null]
	});
}, kt = ({ health: e }) => {
	if (!e) return null;
	let t = e.schedule?.ageDays;
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		className: "schedHealth",
		children: [
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "schedCard",
				children: [/* @__PURE__ */ (0, x.jsxs)("div", {
					className: "schedCardValue",
					children: [
						e.late,
						" ",
						/* @__PURE__ */ (0, x.jsxs)("span", {
							className: "schedCardOf",
							children: ["מתוך ", e.computed]
						})
					]
				}), /* @__PURE__ */ (0, x.jsx)("div", {
					className: "schedCardLabel",
					children: "פעילויות באיחור"
				})]
			}),
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "schedCard",
				children: [/* @__PURE__ */ (0, x.jsx)("div", {
					className: "schedCardValue",
					children: e.totalDaysLate?.toLocaleString?.() ?? e.totalDaysLate
				}), /* @__PURE__ */ (0, x.jsx)("div", {
					className: "schedCardLabel",
					children: "סה\"כ ימי איחור"
				})]
			}),
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "schedCard",
				children: [/* @__PURE__ */ (0, x.jsx)("div", {
					className: "schedCardValue",
					children: e.worst ? `${e.worst.daysLate} ימים` : "—"
				}), /* @__PURE__ */ (0, x.jsxs)("div", {
					className: "schedCardLabel",
					title: e.worst?.name,
					children: ["החריגה הגדולה: ", e.worst?.name ?? "—"]
				})]
			}),
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "schedCard",
				children: [/* @__PURE__ */ (0, x.jsx)("div", {
					className: "schedCardValue",
					children: e.milestonesDelayed
				}), /* @__PURE__ */ (0, x.jsx)("div", {
					className: "schedCardLabel",
					children: "אבני דרך באיחור"
				})]
			}),
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: `schedCard ${t != null && t > 90 ? "schedCardAlarm" : ""}`,
				children: [/* @__PURE__ */ (0, x.jsxs)("div", {
					className: "schedCardValue",
					children: [t ?? "—", " ימים"]
				}), /* @__PURE__ */ (0, x.jsxs)("div", {
					className: "schedCardLabel",
					children: [
						"גיל הלוח (",
						e.schedule?.relevancyDate ?? "—",
						")",
						t != null && t > 90 ? " — לוח מיושן, הביטחון מופחת" : ""
					]
				})]
			})
		]
	});
};
function At() {
	let [e, t] = (0, b.useState)([]), [n, r] = (0, b.useState)(""), [i, a] = (0, b.useState)(""), [o, s] = (0, b.useState)(null), [c, l] = (0, b.useState)(null), [u, d] = (0, b.useState)([]), [f, p] = (0, b.useState)(null), [m, h] = (0, b.useState)(null), [g, _] = (0, b.useState)(!0), [v, y] = (0, b.useState)(null), [S, C] = (0, b.useState)({}), [w, T] = (0, b.useState)(""), [E, ee] = (0, b.useState)("axes"), [D, te] = (0, b.useState)(!0), [O, k] = (0, b.useState)(""), [A, j] = (0, b.useState)(null), [M, N] = (0, b.useState)(!1), [P, F] = (0, b.useState)(!1), [I, ne] = (0, b.useState)(""), [re, ie] = (0, b.useState)([]), L = (0, b.useCallback)(async () => {
		let e = await pt("/api/schedule/projects");
		return t(e.projects ?? []), e.projects ?? [];
	}, []), R = (0, b.useCallback)(async (e, t) => {
		if (e) {
			N(!0), ne("");
			try {
				let n = t ? `&asOf=${encodeURIComponent(t)}` : "", r = (e, t, n) => e.catch((e) => ({
					...t,
					warning: `${n}: ${e.message}`
				})), [i, a, o, c, u] = await Promise.all([
					pt(`/api/schedule/health?projectId=${encodeURIComponent(e)}${n}`),
					pt("/api/schedule/sweep", {
						method: "POST",
						body: {
							projectId: e,
							asOf: t || null,
							persist: !1,
							filters: { excludeCompleted: !1 }
						}
					}),
					r(pt(`/api/schedule/alerts?projectId=${encodeURIComponent(e)}&baselined=false&lifecycle=open,updated`), { alerts: [] }, "טעינת התראות"),
					r(pt(`/api/schedule/alerts?projectId=${encodeURIComponent(e)}&baselined=true`), { count: 0 }, "טעינת היסטוריית התראות"),
					r(pt(`/api/schedule/conditions?projectId=${encodeURIComponent(e)}&status=pending`), { conditions: [] }, "טעינת אבני דרך חוזיות")
				]);
				s(i), l(a), d(o.alerts ?? []), p(c.count ?? 0), h(u), ie([...new Set([
					...i.warnings ?? [],
					...a.warnings ?? [],
					o.warning,
					c.warning,
					u.warning
				].filter(Boolean))]);
			} catch (e) {
				ne(e.message);
			} finally {
				N(!1);
			}
		}
	}, []), ae = (0, b.useCallback)(async () => {
		if (n) {
			F(!0), ne("");
			try {
				await pt("/api/schedule/alert-scan", {
					method: "POST",
					body: {
						projectId: n,
						asOf: i || null
					},
					timeoutMs: 24e4
				}), await R(n, i);
			} catch (e) {
				ne(e.message);
			} finally {
				F(!1);
			}
		}
	}, [
		n,
		i,
		R
	]), oe = (0, b.useCallback)(async (e) => {
		if (!(!n || !e?.id)) {
			y(e.id), ne(""), T("");
			try {
				let t = (await pt("/api/schedule/conditions/resolve", {
					method: "POST",
					body: {
						projectId: n,
						conditionId: e.id,
						commit: !0,
						minConfidence: .8
					},
					timeoutMs: 9e5
				})).results?.[0] ?? {
					status: "error",
					reason: "הסוכן לא החזיר תוצאה"
				};
				C((n) => ({
					...n,
					[e.id]: t
				})), t.status === "resolved" && (T(`הושלם: ${e.name} — המועד החוזי ${t.dueDate} נשמר בבסיס הנתונים.`), await R(n, i));
			} catch (t) {
				C((n) => ({
					...n,
					[e.id]: {
						status: "error",
						reason: t.message
					}
				})), ne(t.message);
			} finally {
				y(null);
			}
		}
	}, [
		n,
		i,
		R
	]);
	(0, b.useEffect)(() => {
		let e = !1;
		return L().then((t) => {
			e || !t.length || r((e) => e || t[0].projectId);
		}).catch((e) => ne(e.message)), () => {
			e = !0;
		};
	}, [L]), (0, b.useEffect)(() => {
		if (!n) return;
		location.hash === "#schedule" && R(n, i);
		let e = () => R(n, i);
		return window.addEventListener("bidoc:schedule-activated", e), () => window.removeEventListener("bidoc:schedule-activated", e);
	}, [
		n,
		i,
		R
	]);
	let z = (0, b.useMemo)(() => [...(c?.indicators ?? []).filter((e) => !(D && e.lateness?.isLate !== !0 || O && !(e.lateness?.daysLate >= Number(O))))].sort((e, t) => Number(t.subject.kind === "milestone") - Number(e.subject.kind === "milestone")), [
		c,
		D,
		O
	]), se = c?.scheduleMeta, ce = (0, b.useMemo)(() => {
		let e = c?.indicators ?? [];
		if (!e.length) return null;
		let t = {
			ok: 2,
			stale: 1,
			missing: 0
		}, n = {};
		for (let r of Object.keys(ut)) r === "scheduleVersions" ? n[r] = Math.max(...e.map((e) => Number(e.gates?.scheduleVersions) || 0)) : n[r] = e.reduce((e, n) => (t[n.gates?.[r]] ?? 0) > (t[e] ?? 0) ? n.gates[r] : e, "missing");
		return n;
	}, [c]);
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		className: "schedulePage",
		dir: "rtl",
		children: [
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "schedToolbar",
				children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("h2", {
					className: "schedTitle",
					children: "לוח זמנים — שלושת הצירים"
				}), se ? /* @__PURE__ */ (0, x.jsxs)("div", {
					className: "schedSubtitle",
					children: [
						"נכון ל-",
						/* @__PURE__ */ (0, x.jsx)("b", { children: c.asOf }),
						" · מקור: ",
						/* @__PURE__ */ (0, x.jsx)("b", { children: se.displayName ?? se.sourceVersionId }),
						" (Data Date: ",
						se.relevancyDate ?? "?",
						") · ",
						se.versionCount,
						" ",
						se.versionCount === 1 ? "גרסה" : "גרסאות"
					]
				}) : null] }), /* @__PURE__ */ (0, x.jsxs)("div", {
					className: "schedControls",
					children: [
						/* @__PURE__ */ (0, x.jsxs)("select", {
							value: n,
							onChange: (e) => r(e.target.value),
							className: "schedSelect",
							children: [!e.length && /* @__PURE__ */ (0, x.jsx)("option", {
								value: "",
								children: "אין לוחות זמנים"
							}), e.map((e) => /* @__PURE__ */ (0, x.jsxs)("option", {
								value: e.projectId,
								children: [
									e.projectId.slice(0, 8),
									"… (",
									e.files,
									" קבצים, עדכני ל-",
									e.latestRelevancyDate ?? "?",
									")"
								]
							}, e.projectId))]
						}),
						/* @__PURE__ */ (0, x.jsx)("input", {
							type: "date",
							value: i,
							onChange: (e) => a(e.target.value),
							className: "schedDate",
							title: "נכון לתאריך (ריק = היום)"
						}),
						/* @__PURE__ */ (0, x.jsx)("button", {
							type: "button",
							className: "schedBtn",
							onClick: () => R(n, i),
							disabled: M || !n,
							children: M ? "טוען…" : "רענן"
						}),
						/* @__PURE__ */ (0, x.jsx)("button", {
							type: "button",
							className: "schedBtn schedBtnPrimary",
							onClick: ae,
							disabled: P || !n,
							title: "סריקה מלאה: חישוב אינדיקטורים, שמירת Snapshots ועדכון התראות",
							children: P ? "סורק…" : "סריקת התראות"
						})
					]
				})]
			}),
			ce ? /* @__PURE__ */ (0, x.jsx)(vt, {
				gates: ce,
				compact: !0
			}) : null,
			I ? /* @__PURE__ */ (0, x.jsx)("div", {
				className: "schedError",
				children: I
			}) : null,
			re.length ? /* @__PURE__ */ (0, x.jsx)("div", {
				className: "schedWarnings",
				children: re.map((e) => /* @__PURE__ */ (0, x.jsxs)("div", { children: ["⚠ ", e] }, e))
			}) : null,
			/* @__PURE__ */ (0, x.jsx)(kt, { health: o }),
			u.length ? /* @__PURE__ */ (0, x.jsx)("div", {
				className: "schedAlerts",
				children: u.map((e) => /* @__PURE__ */ (0, x.jsxs)("div", {
					className: "schedAlertRow",
					children: [
						/* @__PURE__ */ (0, x.jsxs)("span", {
							className: "schedBadge schedSeverity",
							children: ["חומרה ", e.severity_level]
						}),
						/* @__PURE__ */ (0, x.jsx)("b", { children: e.title }),
						/* @__PURE__ */ (0, x.jsx)("span", {
							className: "schedAlertDesc",
							children: e.description
						})
					]
				}, e.id))
			}) : null,
			f ? /* @__PURE__ */ (0, x.jsxs)("div", {
				className: "schedBaselinedNote",
				children: [f, " חריגות סומנו baselined באתחול ההיסטורי — גלויות בצירים למטה, ולא ייצרו התראה עד החמרה מהותית."]
			}) : null,
			w ? /* @__PURE__ */ (0, x.jsx)("div", {
				className: "condResolverResult",
				role: "status",
				children: w
			}) : null,
			/* @__PURE__ */ (0, x.jsx)(Ot, {
				data: m,
				expanded: g,
				onToggle: () => _((e) => !e),
				resolvingId: v,
				onResolve: oe,
				rowResults: S
			}),
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "schedFilters",
				children: [
					/* @__PURE__ */ (0, x.jsxs)("div", {
						className: "schedViewToggle",
						children: [/* @__PURE__ */ (0, x.jsx)("button", {
							type: "button",
							className: E === "axes" ? "is-active" : "",
							onClick: () => ee("axes"),
							children: "צירים"
						}), /* @__PURE__ */ (0, x.jsx)("button", {
							type: "button",
							className: E === "table" ? "is-active" : "",
							onClick: () => ee("table"),
							children: "טבלה"
						})]
					}),
					/* @__PURE__ */ (0, x.jsxs)("label", { children: [/* @__PURE__ */ (0, x.jsx)("input", {
						type: "checkbox",
						checked: D,
						onChange: (e) => te(e.target.checked)
					}), " רק באיחור"] }),
					/* @__PURE__ */ (0, x.jsxs)("label", { children: ["מינימום ימי איחור: ", /* @__PURE__ */ (0, x.jsx)("input", {
						type: "number",
						min: "1",
						value: O,
						onChange: (e) => k(e.target.value),
						className: "schedNum"
					})] }),
					/* @__PURE__ */ (0, x.jsxs)("span", {
						className: "schedCount",
						children: [z.length, " פעילויות"]
					})
				]
			}),
			E === "axes" ? /* @__PURE__ */ (0, x.jsx)(St, {
				indicators: z,
				allIndicators: c?.indicators,
				asOf: c?.asOf,
				selected: A,
				onSelect: j
			}) : /* @__PURE__ */ (0, x.jsx)("div", {
				className: "schedTableWrap",
				children: /* @__PURE__ */ (0, x.jsxs)("table", {
					className: "schedTable",
					children: [/* @__PURE__ */ (0, x.jsx)("thead", { children: /* @__PURE__ */ (0, x.jsxs)("tr", { children: [
						/* @__PURE__ */ (0, x.jsx)("th", { children: "פעילות" }),
						/* @__PURE__ */ (0, x.jsx)("th", { children: "סטטוס" }),
						/* @__PURE__ */ (0, x.jsx)("th", { children: "איחור / נותר" }),
						/* @__PURE__ */ (0, x.jsx)("th", { children: "בסיס" }),
						/* @__PURE__ */ (0, x.jsx)("th", { children: "% ביצוע" }),
						/* @__PURE__ */ (0, x.jsx)("th", { children: "ביטחון" }),
						/* @__PURE__ */ (0, x.jsx)("th", { children: "חומרה" })
					] }) }), /* @__PURE__ */ (0, x.jsxs)("tbody", { children: [z.map((e) => /* @__PURE__ */ (0, x.jsxs)("tr", {
						onClick: () => j(e),
						className: A?.subject.activityKey === e.subject.activityKey ? "is-selected" : "",
						children: [
							/* @__PURE__ */ (0, x.jsxs)("td", {
								className: "schedName",
								children: [e.subject.name, e.subject.isMilestone ? " ◆" : ""]
							}),
							/* @__PURE__ */ (0, x.jsx)("td", { children: /* @__PURE__ */ (0, x.jsx)(gt, { status: e.status }) }),
							/* @__PURE__ */ (0, x.jsx)("td", { children: mt(e.lateness) }),
							/* @__PURE__ */ (0, x.jsx)("td", {
								className: "schedBasis",
								children: ht(e.lateness)
							}),
							/* @__PURE__ */ (0, x.jsx)("td", { children: e.timing?.percentComplete ?? "—" }),
							/* @__PURE__ */ (0, x.jsx)("td", { children: /* @__PURE__ */ (0, x.jsx)(_t, { confidence: e.confidence }) }),
							/* @__PURE__ */ (0, x.jsx)("td", { children: e.severity ?? "—" })
						]
					}, e.subject.activityKey)), !z.length && !M ? /* @__PURE__ */ (0, x.jsx)("tr", { children: /* @__PURE__ */ (0, x.jsx)("td", {
						colSpan: 7,
						className: "schedEmpty",
						children: "אין פעילויות תואמות לפילטר"
					}) }) : null] })]
				})
			}),
			/* @__PURE__ */ (0, x.jsx)(Ct, {
				indicator: A,
				onClose: () => j(null)
			})
		]
	});
}
//#endregion
//#region src/contracts/reviewMode.js
var jt = Object.freeze({
	promotion: "promotion",
	reviewOnly: "review_only",
	blocked: "blocked"
});
function Mt(e) {
	if (!e || typeof e != "object") return jt.blocked;
	let t = Array.isArray(e.globalBlockers) ? e.globalBlockers : [], n = Array.isArray(e.candidatePlans) ? e.candidatePlans : [];
	if (t.length || n.length === 0) return jt.blocked;
	if (e.transactionReady === !0) {
		let e = n.some((e) => e?.status === "transaction_ready"), t = n.some((e) => !["transaction_ready", "rejected"].includes(e?.status));
		return e && !t ? jt.promotion : jt.blocked;
	}
	return n.every((e) => e?.status === "rejected") ? jt.reviewOnly : jt.blocked;
}
//#endregion
//#region src/react/contractsHebrew.js
var Nt = Object.freeze({
	contractual_completion: "השלמת ומסירת העבודות",
	contractual_commencement: "תחילת העבודה החוזית",
	contractual_obligation: "התחייבות חוזית",
	fixed_completion: "מועד השלמה חוזי קבוע",
	daily_delay_charge: "חיוב יומי בגין איחור בהשלמה",
	exceptional_event_notice: "הודעה בכתב על אירוע חריג",
	weekly_waste_removal: "פינוי שבועי של פסולת בנייה",
	monthly_payment_chain: "בדיקת חשבון חודשי ותשלום",
	owner_requested_delay_relief: "דחיית מועד עקב עיכוב שביקש המזמין",
	approved_extension: "הארכת מועד מאושרת",
	completion_inspection: "בדיקת השלמת העבודות",
	manager_set_corrections: "תיקונים במועד שיקבע המפקח",
	performance_bond_delivery: "מסירת ערבות ביצוע",
	performance_bond_renewal: "הארכת ערבות ביצוע",
	notice_service: "מועד קבלת הודעה לפי אופן המסירה"
}), Pt = Object.freeze({
	contractual_completion: "השלם ומסור את העבודות",
	contractual_commencement: "התחל את העבודות במועד החוזי",
	contractual_obligation: "בצע את ההתחייבות החוזית",
	fixed_completion: "השלם את העבודות במועד החוזי הקבוע",
	daily_delay_charge: "שלם חיוב יומי בגין איחור בהשלמה",
	exceptional_event_notice: "מסור הודעה בכתב על אירוע חריג",
	weekly_waste_removal: "פנה פסולת בנייה שהצטברה",
	monthly_payment_chain: "בדוק את החשבון החודשי ושלם את הסכום המאושר",
	owner_requested_delay_relief: "אפשר דחייה מתאימה בגין עיכוב מזכה שביקש המזמין",
	approved_extension: "החל את הארכת המועד המאושרת",
	completion_inspection: "השלם את בדיקת העבודות",
	manager_set_corrections: "השלם את התיקונים בתוך התקופה שיקבע המפקח",
	performance_bond_delivery: "מסור את ערבות הביצוע",
	performance_bond_renewal: "הארך את ערבות הביצוע לפני פקיעתה",
	notice_service: "קבע את מועד קבלת ההודעה לפי אופן המסירה"
}), Ft = Object.freeze({
	authority_unverified: "סמכות המסמך טרם אומתה",
	human_review_required: "נדרשת סקירה אנושית",
	project_binding_unreviewed: "קישור הפרויקט טרם נבדק",
	commencement_event_missing: "חסר אירוע תחילת עבודה",
	trigger_event_missing: "חסר אירוע מפעיל",
	execution_date_unverified: "מועד החתימה טרם אומת",
	inspection_start_event_missing: "חסר אירוע תחילת בדיקה",
	inspection_start_due_missing: "מועד תחילת הבדיקה אינו ידוע",
	bond_expiry_event_missing: "חסר מועד פקיעת הערבות",
	working_calendar_missing: "חסר לוח ימי עבודה מאושר",
	calendar_semantics_unresolved: "משמעות הימים טרם הוכרעה",
	subday_deadline_not_storable_as_date: "לא ניתן לשמור מועד קצר מיום כתאריך",
	compliance_engine_not_approved: "מנוע בדיקת הציות טרם אושר",
	recurring_occurrence_history_not_supported: "היסטוריית מופעים חוזרים עדיין אינה נתמכת",
	compound_rule_not_supported: "כלל חוזי מורכב עדיין אינו נתמך",
	approval_guard_not_supported: "תנאי האישור עדיין אינו נתמך",
	extension_event_missing: "חסר אירוע הארכת מועד",
	quantified_days_missing: "חסר מספר ימים מפורש",
	entitlement_review_required: "נדרשת בדיקת זכאות",
	extension_approval_review_required: "נדרשת בדיקת אישור הארכה",
	existing_milestone_identity_required: "נדרש זיהוי של אבן דרך קיימת",
	offset_missing: "חסר מרווח זמן",
	future_manager_decision_required: "נדרשת החלטה עתידית של המפקח",
	negative_offset_not_supported: "מרווח זמן שלילי אינו נתמך",
	branching_rule_not_supported: "כלל מסועף עדיין אינו נתמך",
	channel_specific_clock_not_supported: "מנגנון זמנים לפי ערוץ מסירה עדיין אינו נתמך",
	material_value_conflict: "קיימת סתירה בערך מהותי",
	contract_conflict_unresolved: "סתירה חוזית טרם נפתרה",
	responsible_party_unverified: "זהות הגורם האחראי טרם אומתה",
	beneficiary_unverified: "זהות הגורם הזכאי טרם אומתה",
	unreadable_pdf_page: "עמוד בחוזה אינו קריא"
}), It = Object.freeze({
	human_review_required: "נדרשת סקירה אנושית",
	project_mapping_inactive: "קישור הפרויקט אינו פעיל",
	schedule_version_conflict: "קיימת סתירה בגרסת לוח הזמנים",
	trigger_evidence_unreviewed: "ראיות האירוע המפעיל טרם נבדקו",
	no_mapping_candidate: "לא נמצאה פעילות מתאימה",
	ambiguous_candidates: "נמצאו כמה חלופות בעלות התאמה זהה",
	canonical_alias_conflict: "קיימת סתירה בזהות הפעילות הקבועה",
	invalid_canonical_key: "זהות הפעילות הקבועה אינה תקינה",
	previous_activity_not_found: "הפעילות מהגרסה הקודמת לא נמצאה",
	current_activity_not_found: "הפעילות בגרסה הנוכחית לא נמצאה",
	duplicate_previous_task_uid: "מזהה פעילות כפול בגרסה הקודמת",
	duplicate_current_task_uid: "מזהה פעילות כפול בגרסה הנוכחית",
	identity_continuity_requires_review: "רציפות זהות הפעילות דורשת סקירה",
	summary_activity_requires_review: "פעילות סיכום דורשת סקירה מפורשת",
	prior_mapping_confidence_below_continuity_gate: "רמת הביטחון הקודמת נמוכה מסף הרציפות"
}), Lt = Object.freeze({
	schema_reuse_not_approved: "שימוש חוזר במבנה הנתונים טרם אושר",
	project_namespace_not_approved: "מרחב מזהי הפרויקט טרם אושר",
	review_audit_persistence_not_approved: "שמירת יומן הסקירה טרם אושרה",
	atomic_promotion_not_approved: "הקידום האטומי טרם אושר",
	permission_model_not_approved: "מודל ההרשאות טרם אושר",
	source_extraction_mode_invalid: "מצב החילוץ אינו מתאים לקידום",
	document_version_missing: "חסרה גרסת מסמך מזוהה",
	review_batch_missing: "חסרה קבוצת החלטות סקירה",
	review_batch_id_missing: "חסר מזהה לקבוצת הסקירה",
	reviewer_identity_invalid: "זהות הסוקר אינה תקינה",
	review_timestamp_invalid: "מועד הסקירה אינו תקין",
	review_reason_insufficient: "נימוק הסקירה קצר מדי",
	document_authority_not_approved: "סמכות המסמך טרם אושרה",
	project_mapping_missing: "חסר קישור בין הפרויקטים",
	project_mapping_not_approved: "קישור הפרויקטים טרם אושר",
	schedule_project_id_invalid: "מזהה פרויקט לוח הזמנים אינו תקין",
	source_project_id_missing: "חסר מזהה פרויקט המקור",
	source_project_id_invalid: "מזהה פרויקט המקור אינו תקין",
	source_project_binding_mismatch: "פרויקט המקור אינו תואם לקישור שנבדק",
	project_mapping_approver_missing: "חסרה זהות מאשר קישור הפרויקטים",
	project_mapping_timestamp_invalid: "מועד אישור קישור הפרויקטים אינו תקין",
	cross_database_mapping_reason_missing: "חסר נימוק לקישור בין מאגרי הנתונים",
	unsupported_review_action: "פעולת הסקירה אינה נתמכת",
	candidate_storage_target_not_operational: "יעד השמירה עדיין אינו תפעולי",
	review_confidence_invalid: "רמת הביטחון של הסקירה אינה תקינה",
	exact_evidence_missing: "חסרה ראיה מדויקת מן החוזה",
	conflict_review_missing: "חסרה החלטה מפורשת בסתירה",
	conflict_selection_not_exclusive: "יש לבחור חלופה יחידה מתוך הסתירה",
	fixed_milestone_date_invalid: "מועד אבן הדרך אינו תקין",
	condition_anchor_missing: "חסר אירוע עוגן לתנאי",
	condition_offset_invalid: "מרווח הזמן של התנאי אינו תקין",
	condition_direction_not_supported: "כיוון מרווח הזמן אינו נתמך",
	condition_offset_unit_not_approved: "יחידת הזמן של התנאי טרם אושרה",
	extension_days_invalid: "מספר ימי ההארכה אינו תקין",
	extension_unit_not_supported: "יחידת הארכת המועד אינה נתמכת",
	extension_approval_invalid: "אישור הארכת המועד אינו תקין",
	extension_milestone_identity_missing: "חסרה אבן הדרך שאליה שייכת ההארכה",
	review_decision_missing: "חסרה החלטת סוקר",
	transaction_batch_blocked: "קבוצת הקידום חסומה"
}), Rt = Object.freeze({
	contracts_model_provider_timeout: "ספק הבינה המלאכותית לא השלים את החילוץ בזמן. לא נשמרה תוצאה חלקית; בניסיון הבא המערכת תשתמש מחדש רק בחלקים שכבר אומתו.",
	contracts_model_time_budget_exceeded: "חילוץ החוזה חרג ממגבלת הזמן הכוללת. לא נשמרה תוצאה חלקית; אפשר לנסות שוב.",
	contracts_model_provider_failed: "ספק הבינה המלאכותית לא הצליח להשלים את חילוץ החוזה. לא נשמרה תוצאה חלקית; אפשר לנסות שוב.",
	contracts_ai_unavailable: "שירות הבינה המלאכותית לחילוץ חוזים אינו מוגדר כעת בצד השרת.",
	contracts_promotion_migration_missing: "תשתית שמירת הסקירה אינה זמינה כעת בצד השרת.",
	contracts_activity_mapping_history_migration_missing: "היסטוריית החלטות המיפוי עדיין אינה זמינה בצד השרת.",
	contracts_activity_mapping_review_migration_missing: "תשתית שמירת החלטות המיפוי עדיין אינה זמינה בצד השרת.",
	contracts_activity_mapping_review_apply_not_approved: "שמירת החלטות מיפוי מושבתת בצד השרת.",
	contracts_activity_mapping_review_selection_stale: "הפעילות שנבחרה כבר אינה מופיעה בחלופות העדכניות. יש לרענן ולבחור מחדש.",
	contracts_activity_mapping_review_conflict_unresolved: "יש לפתור את הסתירה במפורש לפני אישור או תיקון.",
	contracts_activity_mapping_review_blocked: "המיפוי עדיין חסום ואינו בטוח לשמירה.",
	contracts_activity_mapping_context_not_found: "לא נמצא קישור פעיל ומאושר בין פרויקט המקור לפרויקט לוח הזמנים.",
	contracts_activity_mapping_schedule_not_found: "לא נמצאה גרסת לוח זמנים מאושרת לפרויקט.",
	contracts_activity_mapping_database_missing: "חיבור השרת למאגר לוח הזמנים אינו מוגדר.",
	contracts_activity_mapping_database_override_rejected: "הבקשה נדחתה משום שניסתה לשנות את חיבור מסד הנתונים שבבעלות השרת.",
	contracts_workspace_persistence_not_enabled: "שמירת חוזים קבועה עדיין אינה מופעלת בצד השרת.",
	contracts_workspace_migration_missing: "תשתית החוזים השמורים עדיין אינה זמינה ב-APP DATA/KAPAIM.",
	contracts_workspace_database_missing: "חיבור השרת למאגר החוזים השמורים אינו מוגדר.",
	contracts_workspace_storage_bucket_missing: "דלי האחסון הפרטי לחוזים עדיין לא הוגדר.",
	contracts_workspace_storage_bucket_not_private: "דלי אחסון החוזים חייב להיות פרטי לפני שניתן לשמור מסמכים.",
	contracts_workspace_storage_upload_failed: "שמירת קובץ ה-PDF הפרטי נכשלה. תוצאת החילוץ לא נרשמה כחוזה שמור.",
	contracts_workspace_storage_failed: "בדיקת אחסון החוזים נכשלה בצד השרת.",
	contracts_workspace_conflict: "החוזה השמור השתנה או מתנגש עם גרסה קיימת. יש לרענן ולנסות שוב.",
	contracts_workspace_not_found: "החוזה השמור לא נמצא או שאינו זמין עוד.",
	contracts_workspace_timeout: "שמירת החוזה חרגה ממגבלת הזמן. אפשר לרענן את רשימת החוזים ולבדוק אם נשמר.",
	contracts_workspace_transport_failed: "השרת לא הצליח להגיע למאגר החוזים השמורים.",
	contracts_workspace_database_override_rejected: "הבקשה נדחתה משום שניסתה לשנות את חיבור מאגר החוזים שבבעלות השרת."
}), zt = Object.freeze({
	candidate_for_schedule_contract_milestones: "מועמד לאבן דרך חוזית",
	candidate_for_schedule_contract_extensions: "מועמד להארכת מועד חוזית",
	candidate_for_schedule_contract_conditions: "מועמד לתנאי חוזי ממתין",
	dry_run_only: "סקירה בלבד — ללא יעד תפעולי"
}), Bt = Object.freeze({
	contract_source: "ציטוט מדויק מן החוזה",
	preferred_activity_key_exact: "התאמה מלאה למזהה פעילות מועדף",
	preferred_task_uid_exact: "התאמה מלאה למזהה משימה",
	normalized_name_exact: "התאמה מלאה בשם הפעילות",
	token_overlap: "חפיפה במונחי הפעילות",
	milestone_preference: "התאמה להעדפת אבן דרך",
	outline_level_preference: "התאמה לרמת ההיררכיה",
	summary_activity_penalty: "הפחתת ביטחון משום שזו פעילות סיכום",
	confirmed_alias_owner: "זהות פעילות שכבר אושרה",
	conflicting_alias_owners: "סתירה בין זהויות פעילות קיימות",
	invalid_canonical_owner: "זהות פעילות קיימת אינה תקינה"
}), Vt = Object.freeze({
	day: "ימים",
	calendar_day: "ימים קלנדריים",
	calendar_days: "ימים קלנדריים",
	working_day: "ימי עבודה",
	working_days: "ימי עבודה",
	week: "שבועות",
	weeks: "שבועות",
	month: "חודשים",
	months: "חודשים",
	hour: "שעות",
	hours: "שעות"
}), Ht = Object.freeze({
	after: "לאחר האירוע המפעיל",
	before: "לפני האירוע המפעיל"
});
function Ut(e) {
	return Nt[e] || "עובדה חוזית הדורשת סקירה";
}
function Wt(e) {
	return Pt[typeof e == "string" ? e : e?.role] || "בדוק את העובדה החוזית מול הראיה המקורית";
}
function Gt(e) {
	return Ft[e] || "נדרש בירור נוסף לפני קידום";
}
function Kt(e) {
	return It[e] || Gt(e);
}
function qt(e) {
	let t = String(e || "");
	return t.startsWith("review_gate_unresolved:") ? `חסם סקירה טרם נפתר: ${Gt(t.slice(23))}` : t.startsWith("unknown_review_candidate:") ? "התקבלה החלטה עבור מועמד שאינו קיים בחילוץ הנוכחי" : t.startsWith("duplicate_review_decision:") ? "נמצאו כמה החלטות עבור אותו מועמד" : Lt[t] || "הקידום חסום ונדרשת בדיקה נוספת";
}
function Jt(e) {
	return zt[e] || "אין יעד תפעולי מאושר בשלב זה";
}
function Yt(e) {
	return {
		confirm: "אישור",
		reject: "דחייה",
		correct: "תיקון",
		unmapped: "ללא מיפוי"
	}[e] || "החלטת סקירה";
}
function Xt(e) {
	return {
		suggested: "הוצעו חלופות לסקירה",
		blocked: "חסום עד לפתרון מפורש",
		unmapped: "לא נמצאה חלופה",
		not_required: "לא נדרש קישור לפעילות",
		pending_trigger: "ממתין לאימות האירוע המפעיל",
		manually_confirmed: "אושר ידנית",
		auto_confirmed: "המשכיות זהות אושרה אוטומטית",
		rejected: "נדחה"
	}[e] || "מצב דורש בדיקה";
}
function Zt(e) {
	return {
		transaction_ready: "מוכן לטרנזקציה",
		blocked: "חסום",
		rejected: "נדחה"
	}[e] || "מצב טרם נקבע";
}
function Qt(e) {
	return Bt[e] || "ראיית התאמה ללוח הזמנים";
}
function $t(e) {
	return Vt[e] || "יחידות זמן";
}
function en(e) {
	return Ht[e] || "ביחס לאירוע המפעיל";
}
function tn(e) {
	if (!e) return "מועד לא זמין";
	let t = new Date(e);
	return Number.isNaN(t.getTime()) ? "מועד לא זמין" : new Intl.DateTimeFormat("he-IL", {
		dateStyle: "medium",
		timeStyle: "short"
	}).format(t);
}
function nn(e) {
	return e?.name === "AbortError" ? "הפעולה חרגה ממגבלת הזמן. אפשר לנסות שוב." : Rt[e?.code] || "הפעולה נכשלה. אפשר לנסות שוב או לבדוק את הגדרות השרת.";
}
//#endregion
//#region src/react/ContractsPage.jsx
var rn = "652bf3e0-9a1e-47ca-b06f-cd8dc33907f7", an = "81b1cbac-8fcf-43c1-acdc-6b5c809de0e5";
async function on(e, { method: t = "GET", body: n = null, timeoutMs: r = 12e4 } = {}) {
	let i = new AbortController(), a = setTimeout(() => i.abort(), r);
	try {
		let r = await fetch(e, {
			method: t,
			credentials: "same-origin",
			headers: n ? { "Content-Type": "application/json" } : void 0,
			body: n ? JSON.stringify(n) : void 0,
			signal: i.signal
		}), a = await r.json().catch(() => ({}));
		if (!r.ok) {
			let e = Error(a.message || a.error || `HTTP ${r.status}`);
			throw e.code = a.code || (/^[a-z0-9_]+$/u.test(String(a.error || "")) ? a.error : null), e.status = r.status, e;
		}
		return a;
	} finally {
		clearTimeout(a);
	}
}
async function sn(e) {
	let t = new Uint8Array(await e.arrayBuffer()), n = "", r = 32768;
	for (let e = 0; e < t.length; e += r) n += String.fromCharCode(...t.subarray(e, e + r));
	return btoa(n);
}
function cn(e) {
	return {
		action: "reject",
		reason: "",
		gatesReviewed: !1,
		milestoneKey: e.metadata?.milestoneKey || "",
		approvedBy: "",
		calendarSemantics: "",
		conflictReason: ""
	};
}
function ln(e) {
	return e.fixedDate ? `מועד קבוע: ${e.fixedDate}` : e.offset ? `${e.offset.value} ${$t(e.offset.unit)} ${en(e.offset.direction)}` : e.metadata?.extensionAmount ? `הארכה: ${e.metadata.extensionAmount} ${$t(e.metadata.extensionUnit)}` : "ללא ערך זמן סופי";
}
function un(e) {
	return [e.pdfPage ? `עמוד ${e.pdfPage}` : null, e.clause ? `סעיף ${e.clause}` : null].filter(Boolean).join(" · ") || "מיקום מקור לא צוין";
}
function dn(e) {
	return {
		mappingRequirement: "required",
		conditionStatus: e.type === "relative_condition" ? "pending" : "not_applicable",
		triggerEvidenceReviewed: e.type !== "relative_condition",
		preferMilestone: e.storageDisposition === "candidate_for_schedule_contract_milestones",
		activityTerms: [e.action, e.role].filter(Boolean).join("\n"),
		action: "confirm",
		selectedActivityKey: "",
		reason: "",
		conflictResolved: !1,
		supersedesEventId: "",
		reviewRequestId: crypto.randomUUID()
	};
}
function fn(e, t = null) {
	return {
		decisions: Object.fromEntries((e.candidates || []).map((e) => [e.candidateKey, {
			...cn(e),
			...t?.decisions?.[e.candidateKey] || {}
		}])),
		reviewReason: t?.reviewReason || "",
		batchId: t?.batchId || `contracts-review-${crypto.randomUUID()}`,
		reviewedAt: t?.reviewedAt || (/* @__PURE__ */ new Date()).toISOString(),
		mappingDraft: t?.mappingDraft || null
	};
}
function pn({ decisions: e, reviewReason: t, batchId: n, reviewedAt: r, mappingDraft: i }) {
	return {
		decisions: e,
		reviewReason: t,
		batchId: n,
		reviewedAt: r,
		mappingDraft: i
	};
}
function mn(e) {
	return JSON.stringify(e);
}
function hn(e) {
	let t = Number(e?.revision ?? 0);
	return Number.isSafeInteger(t) && t >= 0 ? t : 0;
}
function gn(e, t, n) {
	return {
		documentVersionId: e.document.documentVersionId,
		candidateKey: t.candidateKey,
		milestoneKey: t.metadata?.milestoneKey || null,
		label: t.action || t.role,
		mappingRequirement: n.mappingRequirement,
		conditionStatus: n.conditionStatus,
		triggerEvidenceReviewed: n.triggerEvidenceReviewed,
		preferMilestone: n.preferMilestone,
		preferredTaskUid: null,
		preferredActivityKey: null,
		preferredOutlineLevel: null,
		activityTerms: n.activityTerms.split(/[\n,]/u).map((e) => e.trim()).filter(Boolean),
		sourceEvidence: (t.sourceEvidence || []).map((e, n) => ({
			evidenceId: `${t.candidateKey}:source:${n + 1}`,
			sourceText: e.sourceText,
			pdfPage: e.pdfPage ?? null,
			clause: e.clause ?? null
		}))
	};
}
function _n({ extraction: e, sourceProjectId: t, status: n, statusError: r, savedState: i = null, savedStateKey: a = "", onDraftStateChange: o = null }) {
	let [s, c] = (0, b.useState)(""), [l, u] = (0, b.useState)(null), [d, f] = (0, b.useState)(null), [p, m] = (0, b.useState)([]), [h, g] = (0, b.useState)(""), [_, v] = (0, b.useState)(""), [y, S] = (0, b.useState)(""), [C, w] = (0, b.useState)(null), T = (0, b.useRef)(null), E = (e.candidates || []).find((e) => e.candidateKey === s) || null, ee = p.filter((e) => e.selectedCanonicalKey);
	(0, b.useEffect)(() => {
		let t = (e.candidates || []).find((e) => e.candidateKey === i?.candidateKey) || null, n = t && i?.draft ? {
			...dn(t),
			...i.draft
		} : null;
		c(t?.candidateKey || ""), u(n), f(null), m([]), g(""), S(""), w(null);
	}, [
		e.document?.documentVersionId,
		t,
		a
	]);
	function D(e) {
		u((t) => {
			let n = {
				...t,
				...e
			};
			return o?.({
				candidateKey: s,
				draft: n
			}), n;
		}), w(null);
	}
	function te(e) {
		D(e), f(null);
	}
	function O() {
		setTimeout(() => T.current?.scrollIntoView({
			behavior: "smooth",
			block: "center"
		}), 0);
	}
	async function k(n) {
		g("");
		try {
			m((await on(`/api/contracts/activity-mapping/history?${new URLSearchParams({
				sourceProjectId: t,
				documentVersionId: e.document.documentVersionId,
				candidateKey: n.candidateKey,
				limit: "100"
			})}`)).events || []);
		} catch (e) {
			m([]), g(nn(e));
		}
	}
	async function A(n) {
		let r = dn(n);
		c(n.candidateKey), u(r), o?.({
			candidateKey: n.candidateKey,
			draft: r
		}), f(null), m([]), S(""), w(null), v("candidates"), k(n);
		try {
			let i = (await on("/api/contracts/activity-mapping/candidates", {
				method: "POST",
				body: {
					sourceProjectId: t,
					obligation: gn(e, n, r)
				}
			})).candidateBundle, a = i?.candidates?.[0]?.activityKey || "";
			f(i), u((e) => ({
				...e,
				action: a ? "confirm" : "unmapped",
				selectedActivityKey: a
			})), o?.({
				candidateKey: n.candidateKey,
				draft: {
					...r,
					action: a ? "confirm" : "unmapped",
					selectedActivityKey: a
				}
			}), O();
		} catch (e) {
			S(nn(e));
		} finally {
			v("");
		}
	}
	async function j() {
		if (!(!E || !l)) {
			v("candidates"), S(""), w(null);
			try {
				let n = (await on("/api/contracts/activity-mapping/candidates", {
					method: "POST",
					body: {
						sourceProjectId: t,
						obligation: gn(e, E, l)
					}
				})).candidateBundle, r = n.candidates.some((e) => e.activityKey === l.selectedActivityKey) ? l.selectedActivityKey : n.candidates[0]?.activityKey || "";
				f(n), u((e) => ({
					...e,
					selectedActivityKey: r,
					action: r ? e.action : "unmapped"
				})), o?.({
					candidateKey: s,
					draft: {
						...l,
						selectedActivityKey: r,
						action: r ? l.action : "unmapped"
					}
				}), O();
			} catch (e) {
				S(nn(e));
			} finally {
				v("");
			}
		}
	}
	let M = !!d?.blockers?.includes("trigger_evidence_unreviewed");
	function N(e) {
		D({
			action: e,
			selectedActivityKey: ["confirm", "correct"].includes(e) && (l.selectedActivityKey || d?.candidates?.[0]?.activityKey) || "",
			supersedesEventId: e === "correct" ? l.supersedesEventId : ""
		});
	}
	function P() {
		return !d || !l ? "יש לטעון חלופות עדכניות לפני שמירת החלטה." : l.reason.trim().length < 10 ? "נדרש נימוק החלטת מיפוי של לפחות 10 תווים." : ["confirm", "correct"].includes(l.action) && !l.selectedActivityKey ? "יש לבחור פעילות מדויקת." : l.action === "correct" && !l.supersedesEventId ? "יש לבחור אירוע קודם שהתיקון מחליף." : d.conflict && !l.conflictResolved && ["confirm", "correct"].includes(l.action) ? "יש לפתור את הסתירה במפורש." : l.action === "reject" && d.candidates.length === 0 ? "כאשר אין חלופות יש לבחור ללא מיפוי, ולא דחייה." : "";
	}
	async function F() {
		let n = P();
		if (n) return S(n);
		v("review"), S(""), w(null);
		try {
			w(await on("/api/contracts/activity-mapping/review", {
				method: "POST",
				body: {
					sourceProjectId: t,
					obligation: gn(e, E, l),
					action: l.action,
					selectedActivityKey: ["confirm", "correct"].includes(l.action) ? l.selectedActivityKey : null,
					reason: l.reason.trim(),
					reviewRequestId: l.reviewRequestId,
					conflictResolved: l.conflictResolved,
					supersedesEventId: l.action === "correct" ? l.supersedesEventId : null
				}
			})), u((e) => {
				let t = {
					...e,
					reviewRequestId: crypto.randomUUID()
				};
				return o?.({
					candidateKey: s,
					draft: t
				}), t;
			}), await k(E);
		} catch (e) {
			S(nn(e));
		} finally {
			v("");
		}
	}
	return /* @__PURE__ */ (0, x.jsxs)("section", {
		className: "contractsPanel contractsMappingPanel",
		children: [
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "contractsSectionHeader",
				children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("h2", { children: "4. סקירת קישור לפעילות בלוח" }), /* @__PURE__ */ (0, x.jsx)("p", { children: "המערכת מציגה עד חמש חלופות עדכניות. רק סוקר אנושי יכול לאשר, לדחות, לתקן או להשאיר ללא מיפוי." })] }), /* @__PURE__ */ (0, x.jsx)("span", {
					className: n?.reviewApplyApproved ? "contractsPlanReady" : "contractsPlanBlocked",
					children: n?.reviewApplyApproved ? "כתיבת ביקורת מאושרת" : "כתיבה מושבתת"
				})]
			}),
			(r || !n?.reviewApplyApproved) && /* @__PURE__ */ (0, x.jsx)("p", {
				className: "contractsActivationNotice",
				children: r ? "לא ניתן לטעון את מצב שמירת החלטות המיפוי." : "שער שלב 3F סגור בצד השרת. אפשר לבדוק חלופות והיסטוריה, אך אי אפשר לשמור החלטה."
			}),
			/* @__PURE__ */ (0, x.jsx)("div", {
				className: "contractsMappingCandidates",
				"aria-label": "עובדות חוזיות לקישור",
				children: (e.candidates || []).map((e) => /* @__PURE__ */ (0, x.jsxs)("button", {
					type: "button",
					className: s === e.candidateKey ? "is-selected" : "",
					onClick: () => A(e),
					disabled: !!_,
					children: [
						/* @__PURE__ */ (0, x.jsx)("span", { children: Ut(e.role) }),
						/* @__PURE__ */ (0, x.jsx)("strong", { children: Wt(e) }),
						/* @__PURE__ */ (0, x.jsx)("small", { children: s === e.candidateKey && _ === "candidates" ? "טוען חלופות…" : "בדוק התאמה ללוח" })
					]
				}, e.candidateKey))
			}),
			E && l && /* @__PURE__ */ (0, x.jsxs)("div", {
				className: "contractsMappingWorkspace",
				children: [
					/* @__PURE__ */ (0, x.jsxs)("div", {
						className: "contractsFieldGrid",
						children: [
							/* @__PURE__ */ (0, x.jsxs)("label", { children: ["האם נדרש קישור לפעילות", /* @__PURE__ */ (0, x.jsxs)("select", {
								value: l.mappingRequirement,
								onChange: (e) => te({ mappingRequirement: e.target.value }),
								children: [/* @__PURE__ */ (0, x.jsx)("option", {
									value: "required",
									children: "נדרש"
								}), /* @__PURE__ */ (0, x.jsx)("option", {
									value: "not_required",
									children: "לא נדרש"
								})]
							})] }),
							/* @__PURE__ */ (0, x.jsxs)("label", { children: ["מצב תנאי חוזי", /* @__PURE__ */ (0, x.jsxs)("select", {
								value: l.conditionStatus,
								onChange: (e) => te({ conditionStatus: e.target.value }),
								children: [
									/* @__PURE__ */ (0, x.jsx)("option", {
										value: "not_applicable",
										children: "לא חל"
									}),
									/* @__PURE__ */ (0, x.jsx)("option", {
										value: "pending",
										children: "אירוע מפעיל ממתין לאימות"
									}),
									/* @__PURE__ */ (0, x.jsx)("option", {
										value: "resolved",
										children: "נפתר ונבדק"
									})
								]
							})] }),
							/* @__PURE__ */ (0, x.jsxs)("label", {
								className: "contractsCheck",
								children: [
									/* @__PURE__ */ (0, x.jsx)("input", {
										type: "checkbox",
										checked: l.triggerEvidenceReviewed,
										onChange: (e) => te({ triggerEvidenceReviewed: e.target.checked })
									}),
									"ראיות האירוע המפעיל נבדקו",
									!l.triggerEvidenceReviewed && l.conditionStatus === "pending" && /* @__PURE__ */ (0, x.jsx)("small", { children: "כל עוד תיבה זו אינה מסומנת, המערכת עוצרת לפני חיפוש חלופות ומציגה “טרם בוצע חיפוש”." })
								]
							}),
							/* @__PURE__ */ (0, x.jsxs)("label", {
								className: "contractsCheck",
								children: [/* @__PURE__ */ (0, x.jsx)("input", {
									type: "checkbox",
									checked: l.preferMilestone,
									onChange: (e) => te({ preferMilestone: e.target.checked })
								}), "העדף אבן דרך"]
							})
						]
					}),
					/* @__PURE__ */ (0, x.jsxs)("label", { children: [
						"מונחי מקור להתאמה ללוח, שורה לכל מונח",
						/* @__PURE__ */ (0, x.jsx)("textarea", {
							rows: "3",
							value: l.activityTerms,
							onChange: (e) => te({ activityTerms: e.target.value })
						}),
						/* @__PURE__ */ (0, x.jsx)("small", {
							className: "contractsFieldHint",
							children: "המונחים נשמרים בשפת המקור כדי לא לפגוע בדיוק ההתאמה."
						})
					] }),
					/* @__PURE__ */ (0, x.jsx)("button", {
						type: "button",
						className: "contractsPrimary",
						disabled: !!_,
						onClick: j,
						children: _ === "candidates" ? "טוען מהמקורות המאושרים…" : "רענן חלופות מהלוח הנוכחי"
					}),
					d && /* @__PURE__ */ (0, x.jsxs)(x.Fragment, { children: [
						/* @__PURE__ */ (0, x.jsx)("div", {
							ref: T,
							className: `contractsMappingOutcome ${M ? "is-blocked" : d.candidates.length ? "is-found" : "is-empty"}`,
							role: "status",
							tabIndex: "-1",
							children: M ? "החיפוש טרם בוצע: יש לסמן שראיות האירוע המפעיל נבדקו, ואז ללחוץ שוב על רענון החלופות." : d.candidates.length ? `החיפוש הושלם ונמצאו ${d.candidates.length} חלופות פעילות לבדיקה.` : "החיפוש הושלם, אך לא נמצאה פעילות מתאימה בלוח הנוכחי. ניתן לתעד החלטה ללא מיפוי."
						}),
						/* @__PURE__ */ (0, x.jsxs)("div", {
							className: "contractsMappingSummary",
							children: [
								/* @__PURE__ */ (0, x.jsxs)("span", { children: ["מצב ", /* @__PURE__ */ (0, x.jsx)("strong", { children: Xt(d.decisionState) })] }),
								/* @__PURE__ */ (0, x.jsxs)("span", { children: ["גרסת לוח ", /* @__PURE__ */ (0, x.jsx)("strong", {
									dir: "ltr",
									children: d.scheduleVersion.fileId
								})] }),
								/* @__PURE__ */ (0, x.jsxs)("span", { children: ["חלופות ", /* @__PURE__ */ (0, x.jsx)("strong", { children: M ? "טרם בוצע חיפוש" : d.candidates.length })] }),
								/* @__PURE__ */ (0, x.jsxs)("span", { children: ["סתירת גרסה ", /* @__PURE__ */ (0, x.jsx)("strong", { children: d.scheduleVersion.versionConflict ? "כן" : "לא" })] })
							]
						}),
						(d.blockers || []).length > 0 && /* @__PURE__ */ (0, x.jsx)("div", {
							className: "contractsGateList",
							"aria-label": "חסמי מיפוי",
							children: d.blockers.map((e) => /* @__PURE__ */ (0, x.jsx)("span", { children: Kt(e) }, e))
						}),
						/* @__PURE__ */ (0, x.jsxs)("div", {
							className: "contractsMappingEvidence",
							children: [/* @__PURE__ */ (0, x.jsx)("strong", { children: "ראיה חוזית מדויקת — הציטוט נשמר בשפת המקור" }), (d.obligation.sourceEvidence || []).map((e) => /* @__PURE__ */ (0, x.jsxs)("blockquote", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: un(e) }), /* @__PURE__ */ (0, x.jsx)("p", { children: e.sourceText })] }, e.evidenceId))]
						}),
						/* @__PURE__ */ (0, x.jsxs)("div", {
							className: "contractsAlternativeList",
							"aria-label": "חלופות פעילות",
							children: [d.candidates.map((e) => /* @__PURE__ */ (0, x.jsxs)("label", {
								className: l.selectedActivityKey === e.activityKey ? "is-selected" : "",
								children: [
									/* @__PURE__ */ (0, x.jsx)("input", {
										type: "radio",
										name: "mapping-activity",
										value: e.activityKey,
										checked: l.selectedActivityKey === e.activityKey,
										onChange: () => D({ selectedActivityKey: e.activityKey })
									}),
									/* @__PURE__ */ (0, x.jsxs)("span", {
										className: "contractsAlternativeRank",
										children: ["#", e.rank]
									}),
									/* @__PURE__ */ (0, x.jsxs)("span", { children: [
										/* @__PURE__ */ (0, x.jsxs)("strong", { children: [
											/* @__PURE__ */ (0, x.jsx)("span", {
												className: "contractsSourceLabel",
												children: "שם הפעילות המקורי בלוח:"
											}),
											" ",
											e.taskName
										] }),
										/* @__PURE__ */ (0, x.jsxs)("small", { children: [
											e.plannedStart || "—",
											"–",
											e.plannedFinish || "—",
											" · מזהה משימה ",
											e.taskUid,
											" · רמה ",
											e.outlineLevel
										] }),
										/* @__PURE__ */ (0, x.jsx)("small", {
											dir: "ltr",
											children: e.activityKey
										})
									] }),
									/* @__PURE__ */ (0, x.jsxs)("b", { children: [Math.round(e.confidence * 100), "%"] }),
									/* @__PURE__ */ (0, x.jsxs)("details", { children: [
										/* @__PURE__ */ (0, x.jsx)("summary", { children: "ראיות וחסמים" }),
										(e.evidence || []).map((t, n) => /* @__PURE__ */ (0, x.jsxs)("p", { children: [
											/* @__PURE__ */ (0, x.jsxs)("strong", { children: [Qt(t.kind), ":"] }),
											" ",
											/* @__PURE__ */ (0, x.jsx)("span", {
												dir: "auto",
												children: t.detail
											})
										] }, `${e.activityKey}-${n}`)),
										(e.blockers || []).map((e) => /* @__PURE__ */ (0, x.jsx)("p", {
											className: "is-blocker",
											children: Kt(e)
										}, e))
									] })
								]
							}, e.activityKey)), d.candidates.length === 0 && /* @__PURE__ */ (0, x.jsx)("p", {
								className: "contractsMappingEmpty",
								children: "לא נמצאו חלופות פעילות. ניתן לתעד החלטה \"ללא מיפוי\" בלבד."
							})]
						}),
						d.conflict && /* @__PURE__ */ (0, x.jsxs)("div", {
							className: "contractsConflictBox",
							children: [
								/* @__PURE__ */ (0, x.jsxs)("strong", { children: ["נמצאה סתירה: ", Kt(d.conflict.type)] }),
								/* @__PURE__ */ (0, x.jsx)("p", { children: "אישור אינו אומר שהסעיף תקין; הוא רק בוחר במפורש את הפעילות המתאימה מתוך החלופות הנוכחיות." }),
								/* @__PURE__ */ (0, x.jsxs)("label", {
									className: "contractsCheck",
									children: [/* @__PURE__ */ (0, x.jsx)("input", {
										type: "checkbox",
										checked: l.conflictResolved,
										onChange: (e) => D({ conflictResolved: e.target.checked })
									}), "בדקתי את האירוע המפעיל, הלוח, קישור הפרויקט והסתירה ובחרתי חלופה במפורש"]
								})
							]
						}),
						/* @__PURE__ */ (0, x.jsxs)("div", {
							className: "contractsDecisionRow contractsMappingActions",
							role: "group",
							"aria-label": "החלטת מיפוי",
							children: [
								d.candidates.length > 0 && /* @__PURE__ */ (0, x.jsx)("button", {
									type: "button",
									className: l.action === "confirm" ? "is-selected" : "",
									onClick: () => N("confirm"),
									children: "אשר מיפוי"
								}),
								d.candidates.length > 0 && /* @__PURE__ */ (0, x.jsx)("button", {
									type: "button",
									className: l.action === "reject" ? "is-selected danger" : "",
									onClick: () => N("reject"),
									children: "דחה חלופות"
								}),
								/* @__PURE__ */ (0, x.jsx)("button", {
									type: "button",
									className: l.action === "unmapped" ? "is-selected danger" : "",
									onClick: () => N("unmapped"),
									children: "השאר ללא מיפוי"
								}),
								ee.length > 0 && /* @__PURE__ */ (0, x.jsx)("button", {
									type: "button",
									className: l.action === "correct" ? "is-selected" : "",
									onClick: () => N("correct"),
									children: "תקן החלטה קודמת"
								})
							]
						}),
						l.action === "correct" && /* @__PURE__ */ (0, x.jsxs)("label", { children: ["אירוע קודם שהתיקון מחליף", /* @__PURE__ */ (0, x.jsxs)("select", {
							value: l.supersedesEventId,
							onChange: (e) => D({ supersedesEventId: e.target.value }),
							children: [/* @__PURE__ */ (0, x.jsx)("option", {
								value: "",
								children: "בחר אירוע בלתי־ניתן לשינוי"
							}), ee.map((e) => /* @__PURE__ */ (0, x.jsxs)("option", {
								value: e.eventId,
								children: [
									Yt(e.action),
									" · ",
									tn(e.reviewedAt),
									" · ",
									e.selectedActivityKey || e.selectedCanonicalKey
								]
							}, e.eventId))]
						})] }),
						/* @__PURE__ */ (0, x.jsxs)("label", { children: ["נימוק החלטת מיפוי", /* @__PURE__ */ (0, x.jsx)("textarea", {
							rows: "3",
							value: l.reason,
							onChange: (e) => D({ reason: e.target.value })
						})] }),
						/* @__PURE__ */ (0, x.jsx)("button", {
							type: "button",
							className: "contractsCommit",
							disabled: !!_ || !n?.reviewApplyApproved,
							onClick: F,
							children: _ === "review" ? "שומר אירוע ביקורת אטומי…" : `שמור ${Yt(l.action)}`
						})
					] }),
					y && /* @__PURE__ */ (0, x.jsx)("div", {
						className: "contractsMessage is-error",
						role: "alert",
						children: y
					}),
					C && /* @__PURE__ */ (0, x.jsx)("div", {
						className: "contractsMessage is-success",
						children: "החלטת המיפוי נרשמה כאירוע ביקורת בלתי־ניתן לשינוי."
					}),
					/* @__PURE__ */ (0, x.jsxs)("div", {
						className: "contractsHistory",
						children: [
							/* @__PURE__ */ (0, x.jsxs)("div", {
								className: "contractsSectionHeader",
								children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("h3", { children: "היסטוריית החלטות" }), /* @__PURE__ */ (0, x.jsx)("p", { children: "תיקון מוסיף אירוע חדש ומפנה לאירוע הקודם; הוא אינו מוחק היסטוריה." })] }), /* @__PURE__ */ (0, x.jsx)("button", {
									type: "button",
									onClick: () => k(E),
									disabled: !!_,
									children: "רענן היסטוריה"
								})]
							}),
							h && /* @__PURE__ */ (0, x.jsx)("p", {
								className: "contractsActivationNotice",
								children: h
							}),
							!h && p.length === 0 && /* @__PURE__ */ (0, x.jsx)("p", {
								className: "contractsMappingEmpty",
								children: "אין עדיין החלטות שמורות לעובדה זו."
							}),
							p.map((e) => /* @__PURE__ */ (0, x.jsxs)("article", { children: [
								/* @__PURE__ */ (0, x.jsxs)("header", { children: [/* @__PURE__ */ (0, x.jsx)("strong", { children: Yt(e.action) }), /* @__PURE__ */ (0, x.jsx)("time", {
									dateTime: e.reviewedAt,
									children: tn(e.reviewedAt)
								})] }),
								/* @__PURE__ */ (0, x.jsx)("p", { children: e.reason }),
								/* @__PURE__ */ (0, x.jsxs)("small", { children: ["סוקר: ", /* @__PURE__ */ (0, x.jsx)("span", {
									dir: "ltr",
									children: e.reviewerId
								})] }),
								e.selectedActivityKey && /* @__PURE__ */ (0, x.jsxs)("small", { children: ["פעילות: ", /* @__PURE__ */ (0, x.jsx)("span", {
									dir: "ltr",
									children: e.selectedActivityKey
								})] }),
								e.supersedesEventId && /* @__PURE__ */ (0, x.jsxs)("small", { children: ["מחליף אירוע: ", /* @__PURE__ */ (0, x.jsx)("span", {
									dir: "ltr",
									children: e.supersedesEventId
								})] })
							] }, e.eventId))
						]
					})
				]
			})
		]
	});
}
function vn({ extraction: e, decisions: t, reviewReason: n, batchId: r, reviewedAt: i, sourceProjectId: a, scheduleProjectId: o }) {
	return {
		extraction: e,
		reviewBatch: {
			batchId: r,
			reviewedAt: i,
			reason: n.trim(),
			documentAuthority: "authoritative",
			extractorVersion: e.extractorVersion || "contracts-agent.phase1.v1",
			decisions: e.candidates.map((e) => {
				let n = t[e.candidateKey] || cn(e), r = n.action === "approve";
				return {
					candidateKey: e.candidateKey,
					action: n.action,
					confidence: +!!r,
					resolvedGates: r && n.gatesReviewed ? [...e.gates || []] : [],
					reason: n.reason.trim(),
					...n.milestoneKey.trim() ? { milestoneKey: n.milestoneKey.trim() } : {},
					...n.approvedBy.trim() ? { approvedBy: n.approvedBy.trim() } : {},
					...n.calendarSemantics ? { calendarSemantics: n.calendarSemantics } : {},
					...r && e.conflictGroupId ? { conflictResolution: {
						selectedCandidateKey: e.candidateKey,
						reason: n.conflictReason.trim()
					} } : {}
				};
			})
		},
		projectMapping: {
			sourceProjectId: a.trim(),
			scheduleProjectId: o.trim()
		}
	};
}
function yn({ candidate: e, decision: t, onChange: n }) {
	let r = t.action === "approve", i = Jt(e.storageDisposition), a = e.storageDisposition === "candidate_for_schedule_contract_extensions", o = e.offset?.unit === "day";
	return /* @__PURE__ */ (0, x.jsxs)("article", {
		className: `contractsCandidate ${r ? "is-approved" : "is-rejected"}`,
		children: [
			/* @__PURE__ */ (0, x.jsxs)("header", { children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [
				/* @__PURE__ */ (0, x.jsx)("span", {
					className: "contractsCandidateRole",
					children: Ut(e.role)
				}),
				/* @__PURE__ */ (0, x.jsx)("h3", { children: Wt(e) }),
				/* @__PURE__ */ (0, x.jsx)("p", { children: ln(e) })
			] }), /* @__PURE__ */ (0, x.jsx)("span", {
				className: "contractsTarget",
				children: i
			})] }),
			/* @__PURE__ */ (0, x.jsx)("div", {
				className: "contractsEvidenceList",
				children: (e.sourceEvidence || []).map((t, n) => /* @__PURE__ */ (0, x.jsxs)("blockquote", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: un(t) }), /* @__PURE__ */ (0, x.jsx)("p", { children: t.sourceText })] }, `${e.candidateKey}-evidence-${n}`))
			}),
			(e.gates || []).length > 0 && /* @__PURE__ */ (0, x.jsx)("div", {
				className: "contractsGateList",
				"aria-label": "חסמי קידום",
				children: (e.gates || []).map((e) => /* @__PURE__ */ (0, x.jsx)("span", { children: Gt(e) }, e))
			}),
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "contractsDecisionRow",
				role: "group",
				"aria-label": "החלטת סוקר",
				children: [/* @__PURE__ */ (0, x.jsx)("button", {
					type: "button",
					className: r ? "is-selected" : "",
					onClick: () => n({ action: "approve" }),
					children: "אשר לקידום"
				}), /* @__PURE__ */ (0, x.jsx)("button", {
					type: "button",
					className: r ? "" : "is-selected danger",
					onClick: () => n({ action: "reject" }),
					children: "דחה"
				})]
			}),
			r && /* @__PURE__ */ (0, x.jsxs)("label", {
				className: "contractsCheck",
				children: [/* @__PURE__ */ (0, x.jsx)("input", {
					type: "checkbox",
					checked: t.gatesReviewed,
					onChange: (e) => n({ gatesReviewed: e.target.checked })
				}), "בדקתי את הראיות ופתרתי במפורש את כל החסמים המוצגים"]
			}),
			r && e.storageDisposition === "candidate_for_schedule_contract_milestones" && /* @__PURE__ */ (0, x.jsxs)("label", { children: ["מפתח אבן דרך", /* @__PURE__ */ (0, x.jsx)("input", {
				value: t.milestoneKey,
				onChange: (e) => n({ milestoneKey: e.target.value }),
				placeholder: e.candidateKey
			})] }),
			r && a && /* @__PURE__ */ (0, x.jsxs)("div", {
				className: "contractsFieldGrid",
				children: [/* @__PURE__ */ (0, x.jsxs)("label", { children: ["מפתח אבן הדרך שמקבלת את ההארכה", /* @__PURE__ */ (0, x.jsx)("input", {
					value: t.milestoneKey,
					onChange: (e) => n({ milestoneKey: e.target.value })
				})] }), /* @__PURE__ */ (0, x.jsxs)("label", { children: ["מאשר ההארכה", /* @__PURE__ */ (0, x.jsx)("input", {
					value: t.approvedBy,
					onChange: (e) => n({ approvedBy: e.target.value })
				})] })]
			}),
			r && o && /* @__PURE__ */ (0, x.jsxs)("label", { children: ["משמעות \"יום\" שאושרה", /* @__PURE__ */ (0, x.jsxs)("select", {
				value: t.calendarSemantics,
				onChange: (e) => n({ calendarSemantics: e.target.value }),
				children: [/* @__PURE__ */ (0, x.jsx)("option", {
					value: "",
					children: "לא נבחר"
				}), /* @__PURE__ */ (0, x.jsx)("option", {
					value: "calendar_days",
					children: "ימים קלנדריים"
				})]
			})] }),
			r && e.conflictGroupId && /* @__PURE__ */ (0, x.jsxs)("label", { children: ["נימוק לבחירת מועמד זה מתוך הסתירה", /* @__PURE__ */ (0, x.jsx)("textarea", {
				value: t.conflictReason,
				onChange: (e) => n({ conflictReason: e.target.value }),
				rows: "2"
			})] }),
			/* @__PURE__ */ (0, x.jsxs)("label", { children: ["נימוק החלטה", /* @__PURE__ */ (0, x.jsx)("textarea", {
				value: t.reason,
				onChange: (e) => n({ reason: e.target.value }),
				rows: "2"
			})] })
		]
	});
}
function bn() {
	let [e, t] = (0, b.useState)(null), [n, r] = (0, b.useState)(null), [i, a] = (0, b.useState)(""), [o, s] = (0, b.useState)(null), [c, l] = (0, b.useState)(""), [u, d] = (0, b.useState)([]), [f, p] = (0, b.useState)(null), [m, h] = (0, b.useState)(""), [g, _] = (0, b.useState)("idle"), [v, y] = (0, b.useState)(""), [S, C] = (0, b.useState)(null), [w, T] = (0, b.useState)(null), [E, ee] = (0, b.useState)(rn), [D, te] = (0, b.useState)(an), [O, k] = (0, b.useState)("אולם תצוגה הרצליה"), [A, j] = (0, b.useState)(null), [M, N] = (0, b.useState)({}), [P, F] = (0, b.useState)(""), [I, ne] = (0, b.useState)(""), [re, ie] = (0, b.useState)(""), [L, R] = (0, b.useState)(null), [ae, oe] = (0, b.useState)(null), [z, se] = (0, b.useState)(""), [ce, le] = (0, b.useState)(""), ue = (0, b.useRef)(0), de = (0, b.useRef)(null), fe = (0, b.useRef)(null), pe = (0, b.useRef)(null), me = (0, b.useRef)(""), he = (0, b.useRef)(0), ge = (0, b.useRef)(""), _e = (0, b.useRef)(!1);
	function ve(e) {
		return !!(e && e.epoch === ue.current && e.workspaceId === me.current);
	}
	function ye() {
		de.current && clearTimeout(de.current), de.current = null;
	}
	function be(e) {
		if (!ve(e) || _e.current) return;
		ye();
		let t = Math.max(0, e.readyAt - Date.now());
		de.current = setTimeout(() => {
			de.current = null, xe();
		}, t);
	}
	async function xe() {
		if (fe.current || _e.current) return;
		let e = pe.current;
		if (!ve(e)) {
			pe.current = null;
			return;
		}
		if (pe.current = null, e.snapshot === ge.current) {
			_("saved"), y("");
			return;
		}
		let t = he.current;
		fe.current = e, _("saving"), y("");
		try {
			let n = await on(`/api/contracts/workspaces/${e.workspaceId}/draft`, {
				method: "PUT",
				body: {
					...e.payload,
					expectedRevision: t
				}
			}), r = Number(n.saved?.revision);
			if (!Number.isSafeInteger(r) || r <= t) {
				let e = /* @__PURE__ */ Error("The saved draft revision is invalid.");
				throw e.code = "contracts_workspace_response_invalid", e;
			}
			if (ve(e)) {
				he.current = r, ge.current = e.snapshot, p((t) => t?.workspaceId === e.workspaceId ? {
					...t,
					draft: {
						...t.draft || {},
						...e.payload,
						revision: r,
						updatedAt: n.saved?.updatedAt || (/* @__PURE__ */ new Date()).toISOString(),
						reviewedCount: n.saved?.reviewedCount,
						approvedCount: n.saved?.approvedCount,
						rejectedCount: n.saved?.rejectedCount
					}
				} : t);
				let t = pe.current;
				ve(t) && t.snapshot !== e.snapshot ? _("pending") : _("saved"), Ee();
			}
		} catch (t) {
			if (ve(e) && (t?.status === 409 || t?.code === "contracts_workspace_draft_stale")) {
				_e.current = !0, ue.current += 1, pe.current = null, ye();
				try {
					De((await on(`/api/contracts/workspaces/${e.workspaceId}`)).workspace, "", { autosaveConflictMessage: "הטיוטה השתנתה בחלון אחר. נטענה הגרסה העדכנית מהשרת; השינויים המקומיים שלא נשמרו לא הוחלו ולא דרסו החלטות חדשות יותר." });
				} catch {
					_("conflict"), y("זוהתה טיוטה חדשה יותר ולא בוצעה דריסה. לא ניתן היה לטעון אותה כעת; יש לפתוח מחדש את החוזה השמור לפני עריכה נוספת.");
				}
			} else ve(e) && (_("error"), y(nn(t)));
		} finally {
			fe.current === e && (fe.current = null);
			let t = pe.current;
			ve(t) && !_e.current && be(t);
		}
	}
	(0, b.useEffect)(() => {
		on("/api/contracts/review/status").then(t).catch((e) => le(nn(e))), on("/api/contracts/activity-mapping/status").then(r).catch((e) => a(nn(e))), on("/api/contracts/workspaces/status").then((e) => {
			s(e), e.ready && Ee(e);
		}).catch((e) => l(nn(e)));
	}, []), (0, b.useEffect)(() => {
		if (!o?.ready || !/^[0-9a-f-]{36}$/iu.test(E.trim())) return;
		let e = setTimeout(() => Ee(), 350);
		return () => clearTimeout(e);
	}, [E, o?.ready]), (0, b.useEffect)(() => {
		if (!o?.ready || !f?.workspaceId || !A || !I || !re || _e.current) return;
		let e = pn({
			decisions: M,
			reviewReason: P,
			batchId: I,
			reviewedAt: re,
			mappingDraft: S
		}), t = mn(e), n = fe.current;
		if (t === ge.current && !ve(n)) {
			pe.current = null, ye(), _(f.draft ? "saved" : "idle"), y("");
			return;
		}
		let r = {
			epoch: ue.current,
			workspaceId: f.workspaceId,
			payload: e,
			snapshot: t,
			readyAt: Date.now() + 700
		};
		return pe.current = r, _("pending"), y(""), be(r), ye;
	}, [
		M,
		P,
		I,
		re,
		S,
		A?.document?.documentVersionId,
		f?.workspaceId,
		o?.ready
	]), (0, b.useEffect)(() => () => {
		ue.current += 1, pe.current = null, ye();
	}, []);
	let Se = A?.candidates?.length || 0, Ce = (0, b.useMemo)(() => Object.values(M).filter((e) => e.action === "approve").length, [M]), we = Se - Ce, Te = Mt(L?.plan);
	async function Ee(e = o) {
		if (!(!e?.ready || !/^[0-9a-f-]{36}$/iu.test(E.trim()))) try {
			d((await on(`/api/contracts/workspaces?${new URLSearchParams({
				sourceProjectId: E.trim(),
				limit: "50"
			})}`)).items || []), l("");
		} catch (e) {
			d([]), l(nn(e));
		}
	}
	function De(e, t = "", { autosaveConflictMessage: n = "" } = {}) {
		let r = e.extraction, i = fn(r, e.draft), a = pn(i);
		ye(), ue.current += 1, pe.current = null, _e.current = !!n, me.current = e.workspaceId, he.current = hn(e.draft), ge.current = mn(a), _(n ? "conflict" : e.draft ? "saved" : "idle"), y(n), j(r), N(i.decisions), F(i.reviewReason), ne(i.batchId), ie(i.reviewedAt), C(i.mappingDraft), ee(e.sourceProjectId || r.projectBinding?.projectId || rn), te(e.scheduleProjectId || an), k(e.projectSite || r.projectBinding?.projectSite || ""), p(e), h(t), R(null), oe(null), le(""), T(null);
	}
	async function Oe(e) {
		se("open-workspace"), l("");
		try {
			De((await on(`/api/contracts/workspaces/${e}`)).workspace, "החוזה והחלטות הטיוטה נטענו ללא קריאה חדשה למודל.");
		} catch (e) {
			l(nn(e));
		} finally {
			se("");
		}
	}
	function ke(e, t) {
		N((n) => ({
			...n,
			[e]: {
				...n[e],
				...t
			}
		})), R(null), oe(null);
	}
	function Ae() {
		if (!A) return "יש להריץ חילוץ לפני סקירה.";
		if (P.trim().length < 10) return "נדרש נימוק סקירה כללי של לפחות 10 תווים.";
		for (let e of A.candidates || []) {
			let t = M[e.candidateKey];
			if (!t?.reason?.trim()) return "נדרש נימוק לכל החלטה.";
			if (t.action === "approve" && !t.gatesReviewed) return "יש לאשר במפורש שהחסמים נבדקו לכל מועמד שמקודם.";
			if (t.action === "approve" && e.conflictGroupId && !t.conflictReason.trim()) return "נדרש נימוק מפורש לפתרון סתירה.";
		}
		return "";
	}
	async function je() {
		if (!w) return le("יש לבחור קובץ PDF.");
		se("extract"), le(""), l(""), h(""), R(null), oe(null);
		try {
			let e = await sn(w), t = {
				filename: w.name,
				mediaType: "application/pdf",
				pdfBase64: e,
				mode: "dry_run",
				projectSelection: {
					projectId: E.trim(),
					projectSite: O.trim(),
					selectedByUser: !0
				}
			}, n = o?.ready ? await on("/api/contracts/workspaces/extract", {
				method: "POST",
				timeoutMs: 3e5,
				body: {
					extractionRequest: t,
					scheduleProjectId: D.trim()
				}
			}) : await on("/api/contracts/extract", {
				method: "POST",
				timeoutMs: 3e5,
				body: t
			}), r = n.extraction || n, i = fn(r, n.draft);
			if (o?.ready) {
				let e = n.reused ? "החוזה כבר היה שמור: החילוץ והטיוטה נטענו ללא קריאת מודל וללא עלות טוקנים נוספת." : "החוזה, ה-PDF ותוצאת החילוץ נשמרו. השינויים בהחלטות יישמרו אוטומטית.";
				De({
					...n.workspace,
					extraction: r,
					draft: n.draft || null
				}, e), Ee();
			} else me.current = "", he.current = 0, ge.current = "", p(null), j(r), N(i.decisions), ne(i.batchId), ie(i.reviewedAt), F(i.reviewReason), C(i.mappingDraft), h("השמירה הקבועה עדיין אינה מופעלת בשרת; החילוץ נשמר רק במסך הנוכחי.");
		} catch (e) {
			le(nn(e));
		} finally {
			se("");
		}
	}
	async function Me() {
		let e = Ae();
		if (e) return le(e);
		se("plan"), le("");
		try {
			R(await on("/api/contracts/review/plan", {
				method: "POST",
				body: vn({
					extraction: A,
					decisions: M,
					reviewReason: P,
					batchId: I,
					reviewedAt: re,
					sourceProjectId: E,
					scheduleProjectId: D
				})
			})), oe(null);
		} catch (e) {
			le(nn(e));
		} finally {
			se("");
		}
	}
	async function Ne(e) {
		if (!L) return le("יש להכין ולאמת את תוכנית הסקירה לפני השמירה או הקידום.");
		if (e !== Te || e === jt.blocked) return le("תוכנית הסקירה אינה מוכנה לפעולה בטוחה.");
		let t = e === jt.reviewOnly;
		se(t ? "save-review" : "commit"), le("");
		try {
			let e = vn({
				extraction: A,
				decisions: M,
				reviewReason: P,
				batchId: I,
				reviewedAt: re,
				sourceProjectId: E,
				scheduleProjectId: D
			});
			oe(await on(t ? "/api/contracts/review/save" : "/api/contracts/review/commit", {
				method: "POST",
				body: t ? {
					...e,
					persistReview: !0
				} : {
					...e,
					commit: !0
				}
			}));
		} catch (e) {
			le(nn(e));
		} finally {
			se("");
		}
	}
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		className: "contractsPage",
		children: [
			/* @__PURE__ */ (0, x.jsxs)("header", {
				className: "contractsHero",
				children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [
					/* @__PURE__ */ (0, x.jsx)("p", {
						className: "contractsEyebrow",
						children: "סוכן חוזים · שלב 2 + שלב 3F + שלב 3F.1"
					}),
					/* @__PURE__ */ (0, x.jsx)("h1", { children: "חילוץ, סקירה וקישור עובדות חוזיות ללוח" }),
					/* @__PURE__ */ (0, x.jsx)("p", { children: "עובדות ומיפויי פעילות אינם משפיעים על מנוע הלו״ז לפני סקירה אנושית, פתרון חסמים וכתיבה אטומית מאושרת." })
				] }), /* @__PURE__ */ (0, x.jsxs)("div", {
					className: "contractsModeStack",
					children: [
						/* @__PURE__ */ (0, x.jsxs)("div", {
							className: `contractsMode ${e?.applyApproved ? "is-ready" : "is-paused"}`,
							children: [/* @__PURE__ */ (0, x.jsx)("strong", { children: e?.applyApproved ? "קידום עובדות פעיל" : "קידום עובדות מושבת" }), /* @__PURE__ */ (0, x.jsxs)("span", { children: ["שלב 2 · גרסת תשתית ", e?.migrationVersion || "—"] })]
						}),
						/* @__PURE__ */ (0, x.jsxs)("div", {
							className: `contractsMode ${n?.reviewApplyApproved ? "is-ready" : "is-paused"}`,
							children: [/* @__PURE__ */ (0, x.jsx)("strong", { children: n?.reviewApplyApproved ? "ביקורת מיפוי פעילה" : "ביקורת מיפוי לקריאה בלבד" }), /* @__PURE__ */ (0, x.jsxs)("span", { children: ["שלב 3F · גרסת תשתית ", n?.historyMigrationVersion || "—"] })]
						}),
						/* @__PURE__ */ (0, x.jsxs)("div", {
							className: `contractsMode ${o?.ready ? "is-ready" : "is-paused"}`,
							children: [/* @__PURE__ */ (0, x.jsx)("strong", { children: o?.ready ? "שמירת חוזים פעילה" : "שמירת חוזים ממתינה להפעלה" }), /* @__PURE__ */ (0, x.jsxs)("span", { children: ["שלב 3F.1 · גרסת תשתית ", o?.migrationVersion || "—"] })]
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, x.jsxs)("section", {
				className: "contractsPanel contractsWorkspacePanel",
				children: [
					/* @__PURE__ */ (0, x.jsxs)("div", {
						className: "contractsSectionHeader",
						children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("h2", { children: "חוזים שמורים והמשך עבודה" }), /* @__PURE__ */ (0, x.jsx)("p", { children: "פתיחה מחדש אינה שולחת את ה-PDF למודל. כל גרסת מסמך נשמרת בנפרד והחלטות אינן מועתקות אוטומטית לגרסה חדשה." })] }), /* @__PURE__ */ (0, x.jsx)("span", {
							className: o?.ready ? "contractsPlanReady" : "contractsPlanBlocked",
							children: o?.ready ? "שמירה אוטומטית פעילה" : "שמירה קבועה מושבתת"
						})]
					}),
					!o?.ready && /* @__PURE__ */ (0, x.jsx)("p", {
						className: "contractsActivationNotice",
						children: c || "המיגרציה ודלי האחסון הפרטי עדיין לא הופעלו בשרת. אפשר להמשיך בחילוץ יבש, אך רענון הדף יאבד את הטיוטה."
					}),
					o?.ready && u.length === 0 && /* @__PURE__ */ (0, x.jsx)("p", {
						className: "contractsMappingEmpty",
						children: "אין עדיין חוזים שמורים לפרויקט MAIN הנבחר."
					}),
					o?.ready && u.length > 0 && /* @__PURE__ */ (0, x.jsx)("div", {
						className: "contractsSavedList",
						"aria-label": "חוזים שמורים",
						children: u.map((e) => /* @__PURE__ */ (0, x.jsxs)("article", { children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [
							/* @__PURE__ */ (0, x.jsx)("strong", { children: e.projectSite || e.filename }),
							/* @__PURE__ */ (0, x.jsxs)("span", { children: [
								e.filename,
								" · ",
								e.candidateCount,
								" מועמדים"
							] }),
							/* @__PURE__ */ (0, x.jsx)("small", { children: e.draft ? `${e.draft.reviewedCount}/${e.candidateCount} החלטות עם נימוק · נשמר ${tn(e.draft.updatedAt)}` : `טרם נשמרה טיוטת החלטות · נוצר ${tn(e.createdAt)}` }),
							/* @__PURE__ */ (0, x.jsxs)("small", { children: ["מזהה פרויקט לוח זמנים: ", /* @__PURE__ */ (0, x.jsx)("bdi", {
								dir: "ltr",
								children: e.scheduleProjectId || "לא שויך"
							})] }),
							/* @__PURE__ */ (0, x.jsx)("small", {
								dir: "ltr",
								children: e.documentVersionId
							})
						] }), /* @__PURE__ */ (0, x.jsx)("button", {
							type: "button",
							disabled: !!z,
							onClick: () => Oe(e.workspaceId),
							children: z === "open-workspace" ? "פותח…" : "פתח והמשך"
						})] }, e.workspaceId))
					}),
					o?.ready && c && /* @__PURE__ */ (0, x.jsx)("div", {
						className: "contractsMessage is-error",
						role: "alert",
						children: c
					})
				]
			}),
			/* @__PURE__ */ (0, x.jsxs)("section", {
				className: "contractsPanel",
				children: [
					/* @__PURE__ */ (0, x.jsx)("h2", { children: "1. חוזה וקישור פרויקט" }),
					/* @__PURE__ */ (0, x.jsxs)("div", {
						className: "contractsFieldGrid",
						children: [
							/* @__PURE__ */ (0, x.jsxs)("label", { children: ["קובץ PDF", /* @__PURE__ */ (0, x.jsx)("input", {
								type: "file",
								accept: "application/pdf,.pdf",
								onChange: (e) => T(e.target.files?.[0] || null)
							})] }),
							/* @__PURE__ */ (0, x.jsxs)("label", { children: ["אתר / תיאור פרויקט", /* @__PURE__ */ (0, x.jsx)("input", {
								value: O,
								onChange: (e) => k(e.target.value)
							})] }),
							/* @__PURE__ */ (0, x.jsxs)("label", { children: ["מזהה פרויקט מקור ב־MAIN", /* @__PURE__ */ (0, x.jsx)("input", {
								dir: "ltr",
								value: E,
								onChange: (e) => ee(e.target.value)
							})] }),
							/* @__PURE__ */ (0, x.jsxs)("label", { children: ["מזהה פרויקט לוח זמנים ב־KAPAIM", /* @__PURE__ */ (0, x.jsx)("input", {
								dir: "ltr",
								value: D,
								onChange: (e) => te(e.target.value)
							})] })
						]
					}),
					/* @__PURE__ */ (0, x.jsx)("button", {
						type: "button",
						className: "contractsPrimary",
						disabled: !!z,
						onClick: je,
						children: z === "extract" ? "בודק אם החוזה שמור, ומחלץ רק אם נדרש…" : o?.ready ? "טען, חלץ ושמור חוזה" : "הרץ חילוץ יבש"
					}),
					m && /* @__PURE__ */ (0, x.jsx)("div", {
						className: "contractsMessage is-success",
						role: "status",
						children: m
					})
				]
			}),
			A && /* @__PURE__ */ (0, x.jsxs)("section", {
				className: "contractsPanel",
				children: [
					/* @__PURE__ */ (0, x.jsxs)("div", {
						className: "contractsSectionHeader",
						children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("h2", { children: "2. סקירת מועמדים" }), /* @__PURE__ */ (0, x.jsxs)("p", { children: [
							Se,
							" מועמדים · ",
							Ce,
							" לאישור · ",
							we,
							" לדחייה"
						] })] }), /* @__PURE__ */ (0, x.jsxs)("div", {
							className: "contractsWorkspaceSaveState",
							role: "status",
							children: [/* @__PURE__ */ (0, x.jsx)("span", {
								className: "contractsDryBadge",
								children: "חילוץ יבש · ללא כתיבה ללוח"
							}), f?.workspaceId && /* @__PURE__ */ (0, x.jsx)("span", {
								className: `contractsAutosave is-${g}`,
								children: g === "saving" || g === "pending" ? "שומר טיוטה…" : g === "conflict" ? "זוהתה טיוטה חדשה יותר" : g === "idle" ? "טרם בוצעו שינויים בטיוטה" : g === "error" ? "השמירה האוטומטית נכשלה" : "כל שינויי הטיוטה נשמרו"
							})]
						})]
					}),
					v && /* @__PURE__ */ (0, x.jsx)("div", {
						className: "contractsMessage is-error",
						role: "alert",
						children: v
					}),
					/* @__PURE__ */ (0, x.jsx)("div", {
						className: "contractsCandidateList",
						children: (A.candidates || []).map((e) => /* @__PURE__ */ (0, x.jsx)(yn, {
							candidate: e,
							decision: M[e.candidateKey],
							onChange: (t) => ke(e.candidateKey, t)
						}, e.candidateKey))
					}),
					/* @__PURE__ */ (0, x.jsxs)("label", {
						className: "contractsReviewReason",
						children: ["נימוק סקירה כללי", /* @__PURE__ */ (0, x.jsx)("textarea", {
							rows: "3",
							value: P,
							onChange: (e) => {
								F(e.target.value), R(null);
							}
						})]
					}),
					/* @__PURE__ */ (0, x.jsx)("button", {
						type: "button",
						className: "contractsPrimary",
						disabled: !!z,
						onClick: Me,
						children: z === "plan" ? "בודק תוכנית…" : "הכן ובדוק תוכנית קידום"
					})
				]
			}),
			L && /* @__PURE__ */ (0, x.jsxs)("section", {
				className: "contractsPanel contractsPlanPanel",
				children: [
					/* @__PURE__ */ (0, x.jsxs)("div", {
						className: "contractsSectionHeader",
						children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("h2", { children: "3. תוכנית טרנזקציה" }), /* @__PURE__ */ (0, x.jsxs)("p", { children: [
							"מצב: ",
							Zt(L.plan?.status),
							" · פעולה בטוחה: ",
							Te === jt.promotion ? "קידום עובדות מאושרות" : Te === jt.reviewOnly ? "שמירת סקירה בלבד" : "אין"
						] })] }), /* @__PURE__ */ (0, x.jsx)("span", {
							className: Te === jt.blocked ? "contractsPlanBlocked" : "contractsPlanReady",
							children: Te === jt.promotion ? "מוכן לקידום" : Te === jt.reviewOnly ? "מוכן לשמירת סקירה" : "חסום"
						})]
					}),
					(L.plan?.globalBlockers || []).length > 0 && /* @__PURE__ */ (0, x.jsx)("ul", {
						className: "contractsBlockers",
						children: L.plan.globalBlockers.map((e) => /* @__PURE__ */ (0, x.jsx)("li", { children: qt(e) }, e))
					}),
					/* @__PURE__ */ (0, x.jsxs)("div", {
						className: "contractsPlanCounts",
						children: [
							/* @__PURE__ */ (0, x.jsxs)("span", { children: ["אבני דרך ", /* @__PURE__ */ (0, x.jsx)("strong", { children: L.plan?.rowsByTable?.schedule_contract_milestones?.length || 0 })] }),
							/* @__PURE__ */ (0, x.jsxs)("span", { children: ["הארכות ", /* @__PURE__ */ (0, x.jsx)("strong", { children: L.plan?.rowsByTable?.schedule_contract_extensions?.length || 0 })] }),
							/* @__PURE__ */ (0, x.jsxs)("span", { children: ["תנאים ", /* @__PURE__ */ (0, x.jsx)("strong", { children: L.plan?.rowsByTable?.schedule_contract_conditions?.length || 0 })] })
						]
					}),
					Te === jt.reviewOnly && /* @__PURE__ */ (0, x.jsxs)("div", {
						className: "contractsActionBlock",
						children: [
							/* @__PURE__ */ (0, x.jsx)("p", { children: "כל המועמדים נדחו. הפעולה תשמור ביקורת בלתי־ניתנת לשינוי בלבד ותיצור אפס רשומות לו״ז." }),
							!e?.applyApproved && /* @__PURE__ */ (0, x.jsx)("p", {
								className: "contractsActivationNotice",
								children: "שמירת ביקורות מושבתת בצד השרת. שינוי תשתית הנתונים אינו נבדק או מופעל מכפתור זה."
							}),
							/* @__PURE__ */ (0, x.jsx)("button", {
								type: "button",
								className: "contractsCommit contractsReviewOnlyAction",
								disabled: !!z || !e?.applyApproved,
								onClick: () => Ne(jt.reviewOnly),
								children: z === "save-review" ? "שומר סקירה ללא קידום…" : "שמור סקירה ללא קידום"
							})
						]
					}),
					Te === jt.promotion && /* @__PURE__ */ (0, x.jsxs)("div", {
						className: "contractsActionBlock",
						children: [
							/* @__PURE__ */ (0, x.jsx)("p", { children: "רק העובדות שאושרו ועמדו בכל החסמים ייכתבו אטומית לטבלאות הלו״ז הקיימות." }),
							!e?.applyApproved && /* @__PURE__ */ (0, x.jsx)("p", {
								className: "contractsActivationNotice",
								children: "קידום עובדות מושבת בצד השרת. נדרש אישור הפעלה נפרד."
							}),
							/* @__PURE__ */ (0, x.jsx)("button", {
								type: "button",
								className: "contractsCommit",
								disabled: !!z || !e?.applyApproved,
								onClick: () => Ne(jt.promotion),
								children: z === "commit" ? "מבצע קידום אטומי…" : "קדם עובדות מאושרות"
							})
						]
					}),
					Te === jt.blocked && /* @__PURE__ */ (0, x.jsxs)("div", {
						className: "contractsActionBlock",
						children: [/* @__PURE__ */ (0, x.jsx)("p", {
							className: "contractsActivationNotice",
							children: "התוכנית כוללת החלטה חסרה או מועמד שאושר אך עדיין אינו בטוח לקידום. יש לחזור לסקירה ולפתור את החסמים."
						}), /* @__PURE__ */ (0, x.jsx)("button", {
							type: "button",
							className: "contractsCommit",
							disabled: !0,
							children: "נדרשת השלמת חסמים"
						})]
					})
				]
			}),
			A && /* @__PURE__ */ (0, x.jsx)(_n, {
				extraction: A,
				sourceProjectId: E.trim(),
				status: n,
				statusError: i,
				savedState: S,
				savedStateKey: f?.workspaceId || "",
				onDraftStateChange: C
			}),
			ce && /* @__PURE__ */ (0, x.jsx)("div", {
				className: "contractsMessage is-error",
				role: "alert",
				children: ce
			}),
			ae && /* @__PURE__ */ (0, x.jsx)("div", {
				className: "contractsMessage is-success",
				children: ae.status === "reviewed_no_promotion" ? "הסקירה נשמרה ביומן הביקורת בלבד. לא קודמו ולא נוצרו רשומות לו״ז." : `הקידום הושלם. קודמו ${ae.promotedCount} רשומות.`
			})
		]
	});
}
//#endregion
//#region src/react/main.jsx
var xn = /* @__PURE__ */ new WeakMap();
function Sn({ label: e = "React bridge ready" }) {
	return /* @__PURE__ */ (0, x.jsx)("span", {
		className: "reactBridgeStatus",
		"data-react-ready": "true",
		children: e
	});
}
var Cn = {
	status: Sn,
	settings: Se,
	workflow: Oe,
	insights: Ge,
	schedule: At,
	contracts: bn
};
function wn(e) {
	let t = Cn[e.dataset.reactIsland];
	if (!t || xn.has(e)) return !1;
	let n = e.dataset.reactProps ? JSON.parse(e.dataset.reactProps) : {}, r = (0, y.createRoot)(e);
	return r.render(/* @__PURE__ */ (0, x.jsx)(b.StrictMode, { children: /* @__PURE__ */ (0, x.jsx)(t, { ...n }) })), xn.set(e, r), !0;
}
function Tn(e = document) {
	return Array.from(e.querySelectorAll("[data-react-island]")).reduce((e, t) => e + +!!wn(t), 0);
}
typeof window < "u" && (window.BiDocReact = {
	islands: Object.keys(Cn),
	mountReactIslands: Tn,
	version: "0.1.0"
}, document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", () => Tn(), { once: !0 }) : Tn());
//#endregion
export { Tn as mountReactIslands };
