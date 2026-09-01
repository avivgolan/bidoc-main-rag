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
	function D(e, t) {
		return E(e.type, t, e.props);
	}
	function O(e) {
		return typeof e == "object" && !!e && e.$$typeof === t;
	}
	function k(e) {
		var t = {
			"=": "=0",
			":": "=2"
		};
		return "$" + e.replace(/[=:]/g, function(e) {
			return t[e];
		});
	}
	var A = /\/+/g;
	function j(e, t) {
		return typeof e == "object" && e && e.key != null ? k("" + e.key) : t.toString(36);
	}
	function M(e) {
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
	function N(e, r, i, a, o) {
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
				case d: return c = e._init, N(c(e._payload), r, i, a, o);
			}
		}
		if (c) return o = o(e), c = a === "" ? "." + j(e, 0) : a, S(o) ? (i = "", c != null && (i = c.replace(A, "$&/") + "/"), N(o, r, i, "", function(e) {
			return e;
		})) : o != null && (O(o) && (o = D(o, i + (o.key == null || e && e.key === o.key ? "" : ("" + o.key).replace(A, "$&/") + "/") + c)), r.push(o)), 1;
		c = 0;
		var l = a === "" ? "." : a + ":";
		if (S(e)) for (var u = 0; u < e.length; u++) a = e[u], s = l + j(a, u), c += N(a, r, i, s, o);
		else if (u = m(e), typeof u == "function") for (e = u.call(e), u = 0; !(a = e.next()).done;) a = a.value, s = l + j(a, u++), c += N(a, r, i, s, o);
		else if (s === "object") {
			if (typeof e.then == "function") return N(M(e), r, i, a, o);
			throw r = String(e), Error("Objects are not valid as a React child (found: " + (r === "[object Object]" ? "object with keys {" + Object.keys(e).join(", ") + "}" : r) + "). If you meant to render a collection of children, use an array instead.");
		}
		return c;
	}
	function P(e, t, n) {
		if (e == null) return e;
		var r = [], i = 0;
		return N(e, r, "", "", function(e) {
			return t.call(n, e, i++);
		}), r;
	}
	function F(e) {
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
	var I = typeof reportError == "function" ? reportError : function(e) {
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
	}, L = {
		map: P,
		forEach: function(e, t, n) {
			P(e, function() {
				t.apply(this, arguments);
			}, n);
		},
		count: function(e) {
			var t = 0;
			return P(e, function() {
				t++;
			}), t;
		},
		toArray: function(e) {
			return P(e, function(e) {
				return e;
			}) || [];
		},
		only: function(e) {
			if (!O(e)) throw Error("React.Children.only expected to receive a single React element child.");
			return e;
		}
	};
	e.Activity = f, e.Children = L, e.Component = v, e.Fragment = r, e.Profiler = a, e.PureComponent = b, e.StrictMode = i, e.Suspense = l, e.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = w, e.__COMPILER_RUNTIME = {
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
	}, e.isValidElement = O, e.lazy = function(e) {
		return {
			$$typeof: d,
			_payload: {
				_status: -1,
				_result: e
			},
			_init: F
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
			i !== null && i(n, r), typeof r == "object" && r && typeof r.then == "function" && r.then(C, I);
		} catch (e) {
			I(e);
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
		if (h = !1, b(e), !m) if (n(c) !== null) m = !0, S || (S = !0, O());
		else {
			var t = n(l);
			t !== null && j(x, t.startTime - e);
		}
	}
	var S = !1, C = -1, w = 5, T = -1;
	function E() {
		return g ? !0 : !(e.unstable_now() - T < w);
	}
	function D() {
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
								u !== null && j(x, u.startTime - t), i = !1;
							}
						}
						break a;
					} finally {
						d = null, f = a, p = !1;
					}
					i = void 0;
				}
			} finally {
				i ? O() : S = !1;
			}
		}
	}
	var O;
	if (typeof y == "function") O = function() {
		y(D);
	};
	else if (typeof MessageChannel < "u") {
		var k = new MessageChannel(), A = k.port2;
		k.port1.onmessage = D, O = function() {
			A.postMessage(null);
		};
	} else O = function() {
		_(D, 0);
	};
	function j(t, n) {
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
		}, a > o ? (r.sortIndex = a, t(l, r), n(c) === null && r === n(l) && (h ? (v(C), C = -1) : h = !0, j(x, a - o))) : (r.sortIndex = s, t(c, r), m || p || (m = !0, S || (S = !0, O()))), r;
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
	var h = Object.assign, g = Symbol.for("react.element"), _ = Symbol.for("react.transitional.element"), v = Symbol.for("react.portal"), y = Symbol.for("react.fragment"), b = Symbol.for("react.strict_mode"), x = Symbol.for("react.profiler"), S = Symbol.for("react.consumer"), C = Symbol.for("react.context"), w = Symbol.for("react.forward_ref"), T = Symbol.for("react.suspense"), E = Symbol.for("react.suspense_list"), D = Symbol.for("react.memo"), O = Symbol.for("react.lazy"), k = Symbol.for("react.activity"), A = Symbol.for("react.memo_cache_sentinel"), j = Symbol.iterator;
	function M(e) {
		return typeof e != "object" || !e ? null : (e = j && e[j] || e["@@iterator"], typeof e == "function" ? e : null);
	}
	var N = Symbol.for("react.client.reference");
	function P(e) {
		if (e == null) return null;
		if (typeof e == "function") return e.$$typeof === N ? null : e.displayName || e.name || null;
		if (typeof e == "string") return e;
		switch (e) {
			case y: return "Fragment";
			case x: return "Profiler";
			case b: return "StrictMode";
			case T: return "Suspense";
			case E: return "SuspenseList";
			case k: return "Activity";
		}
		if (typeof e == "object") switch (e.$$typeof) {
			case v: return "Portal";
			case C: return e.displayName || "Context";
			case S: return (e._context.displayName || "Context") + ".Consumer";
			case w:
				var t = e.render;
				return e = e.displayName, e ||= (e = t.displayName || t.name || "", e === "" ? "ForwardRef" : "ForwardRef(" + e + ")"), e;
			case D: return t = e.displayName || null, t === null ? P(e.type) || "Memo" : t;
			case O:
				t = e._payload, e = e._init;
				try {
					return P(e(t));
				} catch {}
		}
		return null;
	}
	var F = Array.isArray, I = n.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, L = r.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, R = {
		pending: !1,
		data: null,
		method: null,
		action: null
	}, z = [], ee = -1;
	function te(e) {
		return { current: e };
	}
	function B(e) {
		0 > ee || (e.current = z[ee], z[ee] = null, ee--);
	}
	function V(e, t) {
		ee++, z[ee] = e.current, e.current = t;
	}
	var ne = te(null), re = te(null), ie = te(null), ae = te(null);
	function oe(e, t) {
		switch (V(ie, t), V(re, e), V(ne, null), t.nodeType) {
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
		B(ne), V(ne, e);
	}
	function se() {
		B(ne), B(re), B(ie);
	}
	function ce(e) {
		e.memoizedState !== null && V(ae, e);
		var t = ne.current, n = Hd(t, e.type);
		t !== n && (V(re, e), V(ne, n));
	}
	function le(e) {
		re.current === e && (B(ne), B(re)), ae.current === e && (B(ae), Qf._currentValue = R);
	}
	var ue, de;
	function fe(e) {
		if (ue === void 0) try {
			throw Error();
		} catch (e) {
			var t = e.stack.trim().match(/\n( *(at )?)/);
			ue = t && t[1] || "", de = -1 < e.stack.indexOf("\n    at") ? " (<anonymous>)" : -1 < e.stack.indexOf("@") ? "@unknown:0:0" : "";
		}
		return "\n" + ue + e + de;
	}
	var pe = !1;
	function me(e, t) {
		if (!e || pe) return "";
		pe = !0;
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
			pe = !1, Error.prepareStackTrace = n;
		}
		return (n = e ? e.displayName || e.name : "") ? fe(n) : "";
	}
	function he(e, t) {
		switch (e.tag) {
			case 26:
			case 27:
			case 5: return fe(e.type);
			case 16: return fe("Lazy");
			case 13: return e.child !== t && t !== null ? fe("Suspense Fallback") : fe("Suspense");
			case 19: return fe("SuspenseList");
			case 0:
			case 15: return me(e.type, !1);
			case 11: return me(e.type.render, !1);
			case 1: return me(e.type, !0);
			case 31: return fe("Activity");
			default: return "";
		}
	}
	function ge(e) {
		try {
			var t = "", n = null;
			do
				t += he(e, n), n = e, e = e.return;
			while (e);
			return t;
		} catch (e) {
			return "\nError generating stack: " + e.message + "\n" + e.stack;
		}
	}
	var _e = Object.prototype.hasOwnProperty, ve = t.unstable_scheduleCallback, ye = t.unstable_cancelCallback, be = t.unstable_shouldYield, xe = t.unstable_requestPaint, H = t.unstable_now, Se = t.unstable_getCurrentPriorityLevel, Ce = t.unstable_ImmediatePriority, we = t.unstable_UserBlockingPriority, Te = t.unstable_NormalPriority, Ee = t.unstable_LowPriority, De = t.unstable_IdlePriority, Oe = t.log, ke = t.unstable_setDisableYieldValue, Ae = null, je = null;
	function Me(e) {
		if (typeof Oe == "function" && ke(e), je && typeof je.setStrictMode == "function") try {
			je.setStrictMode(Ae, e);
		} catch {}
	}
	var U = Math.clz32 ? Math.clz32 : Fe, Ne = Math.log, Pe = Math.LN2;
	function Fe(e) {
		return e >>>= 0, e === 0 ? 32 : 31 - (Ne(e) / Pe | 0) | 0;
	}
	var Ie = 256, Le = 262144, Re = 4194304;
	function ze(e) {
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
	function Be(e, t, n) {
		var r = e.pendingLanes;
		if (r === 0) return 0;
		var i = 0, a = e.suspendedLanes, o = e.pingedLanes;
		e = e.warmLanes;
		var s = r & 134217727;
		return s === 0 ? (s = r & ~a, s === 0 ? o === 0 ? n || (n = r & ~e, n !== 0 && (i = ze(n))) : i = ze(o) : i = ze(s)) : (r = s & ~a, r === 0 ? (o &= s, o === 0 ? n || (n = s & ~e, n !== 0 && (i = ze(n))) : i = ze(o)) : i = ze(r)), i === 0 ? 0 : t !== 0 && t !== i && (t & a) === 0 && (a = i & -i, n = t & -t, a >= n || a === 32 && n & 4194048) ? t : i;
	}
	function Ve(e, t) {
		return (e.pendingLanes & ~(e.suspendedLanes & ~e.pingedLanes) & t) === 0;
	}
	function He(e, t) {
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
	function Ue() {
		var e = Re;
		return Re <<= 1, !(Re & 62914560) && (Re = 4194304), e;
	}
	function We(e) {
		for (var t = [], n = 0; 31 > n; n++) t.push(e);
		return t;
	}
	function Ge(e, t) {
		e.pendingLanes |= t, t !== 268435456 && (e.suspendedLanes = 0, e.pingedLanes = 0, e.warmLanes = 0);
	}
	function Ke(e, t, n, r, i, a) {
		var o = e.pendingLanes;
		e.pendingLanes = n, e.suspendedLanes = 0, e.pingedLanes = 0, e.warmLanes = 0, e.expiredLanes &= n, e.entangledLanes &= n, e.errorRecoveryDisabledLanes &= n, e.shellSuspendCounter = 0;
		var s = e.entanglements, c = e.expirationTimes, l = e.hiddenUpdates;
		for (n = o & ~n; 0 < n;) {
			var u = 31 - U(n), d = 1 << u;
			s[u] = 0, c[u] = -1;
			var f = l[u];
			if (f !== null) for (l[u] = null, u = 0; u < f.length; u++) {
				var p = f[u];
				p !== null && (p.lane &= -536870913);
			}
			n &= ~d;
		}
		r !== 0 && qe(e, r, 0), a !== 0 && i === 0 && e.tag !== 0 && (e.suspendedLanes |= a & ~(o & ~t));
	}
	function qe(e, t, n) {
		e.pendingLanes |= t, e.suspendedLanes &= ~t;
		var r = 31 - U(t);
		e.entangledLanes |= t, e.entanglements[r] = e.entanglements[r] | 1073741824 | n & 261930;
	}
	function Je(e, t) {
		var n = e.entangledLanes |= t;
		for (e = e.entanglements; n;) {
			var r = 31 - U(n), i = 1 << r;
			i & t | e[r] & t && (e[r] |= t), n &= ~i;
		}
	}
	function Ye(e, t) {
		var n = t & -t;
		return n = n & 42 ? 1 : Xe(n), (n & (e.suspendedLanes | t)) === 0 ? n : 0;
	}
	function Xe(e) {
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
	function Ze(e) {
		return e &= -e, 2 < e ? 8 < e ? e & 134217727 ? 32 : 268435456 : 8 : 2;
	}
	function Qe() {
		var e = L.p;
		return e === 0 ? (e = window.event, e === void 0 ? 32 : mp(e.type)) : e;
	}
	function $e(e, t) {
		var n = L.p;
		try {
			return L.p = e, t();
		} finally {
			L.p = n;
		}
	}
	var et = Math.random().toString(36).slice(2), tt = "__reactFiber$" + et, nt = "__reactProps$" + et, rt = "__reactContainer$" + et, W = "__reactEvents$" + et, G = "__reactListeners$" + et, it = "__reactHandles$" + et, at = "__reactResources$" + et, ot = "__reactMarker$" + et;
	function st(e) {
		delete e[tt], delete e[nt], delete e[W], delete e[G], delete e[it];
	}
	function ct(e) {
		var t = e[tt];
		if (t) return t;
		for (var n = e.parentNode; n;) {
			if (t = n[rt] || n[tt]) {
				if (n = t.alternate, t.child !== null || n !== null && n.child !== null) for (e = df(e); e !== null;) {
					if (n = e[tt]) return n;
					e = df(e);
				}
				return t;
			}
			e = n, n = e.parentNode;
		}
		return null;
	}
	function lt(e) {
		if (e = e[tt] || e[rt]) {
			var t = e.tag;
			if (t === 5 || t === 6 || t === 13 || t === 31 || t === 26 || t === 27 || t === 3) return e;
		}
		return null;
	}
	function ut(e) {
		var t = e.tag;
		if (t === 5 || t === 26 || t === 27 || t === 6) return e.stateNode;
		throw Error(i(33));
	}
	function dt(e) {
		var t = e[at];
		return t ||= e[at] = {
			hoistableStyles: /* @__PURE__ */ new Map(),
			hoistableScripts: /* @__PURE__ */ new Map()
		}, t;
	}
	function ft(e) {
		e[ot] = !0;
	}
	var pt = /* @__PURE__ */ new Set(), mt = {};
	function ht(e, t) {
		gt(e, t), gt(e + "Capture", t);
	}
	function gt(e, t) {
		for (mt[e] = t, e = 0; e < t.length; e++) pt.add(t[e]);
	}
	var _t = RegExp("^[:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD][:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040]*$"), vt = {}, yt = {};
	function bt(e) {
		return _e.call(yt, e) ? !0 : _e.call(vt, e) ? !1 : _t.test(e) ? yt[e] = !0 : (vt[e] = !0, !1);
	}
	function xt(e, t, n) {
		if (bt(t)) if (n === null) e.removeAttribute(t);
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
	function St(e, t, n) {
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
	function Ct(e, t, n, r) {
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
	function wt(e) {
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
	function Tt(e) {
		var t = e.type;
		return (e = e.nodeName) && e.toLowerCase() === "input" && (t === "checkbox" || t === "radio");
	}
	function Et(e, t, n) {
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
	function Dt(e) {
		if (!e._valueTracker) {
			var t = Tt(e) ? "checked" : "value";
			e._valueTracker = Et(e, t, "" + e[t]);
		}
	}
	function Ot(e) {
		if (!e) return !1;
		var t = e._valueTracker;
		if (!t) return !0;
		var n = t.getValue(), r = "";
		return e && (r = Tt(e) ? e.checked ? "true" : "false" : e.value), e = r, e === n ? !1 : (t.setValue(e), !0);
	}
	function kt(e) {
		if (e ||= typeof document < "u" ? document : void 0, e === void 0) return null;
		try {
			return e.activeElement || e.body;
		} catch {
			return e.body;
		}
	}
	var At = /[\n"\\]/g;
	function jt(e) {
		return e.replace(At, function(e) {
			return "\\" + e.charCodeAt(0).toString(16) + " ";
		});
	}
	function Mt(e, t, n, r, i, a, o, s) {
		e.name = "", o != null && typeof o != "function" && typeof o != "symbol" && typeof o != "boolean" ? e.type = o : e.removeAttribute("type"), t == null ? o !== "submit" && o !== "reset" || e.removeAttribute("value") : o === "number" ? (t === 0 && e.value === "" || e.value != t) && (e.value = "" + wt(t)) : e.value !== "" + wt(t) && (e.value = "" + wt(t)), t == null ? n == null ? r != null && e.removeAttribute("value") : Pt(e, o, wt(n)) : Pt(e, o, wt(t)), i == null && a != null && (e.defaultChecked = !!a), i != null && (e.checked = i && typeof i != "function" && typeof i != "symbol"), s != null && typeof s != "function" && typeof s != "symbol" && typeof s != "boolean" ? e.name = "" + wt(s) : e.removeAttribute("name");
	}
	function Nt(e, t, n, r, i, a, o, s) {
		if (a != null && typeof a != "function" && typeof a != "symbol" && typeof a != "boolean" && (e.type = a), t != null || n != null) {
			if (!(a !== "submit" && a !== "reset" || t != null)) {
				Dt(e);
				return;
			}
			n = n == null ? "" : "" + wt(n), t = t == null ? n : "" + wt(t), s || t === e.value || (e.value = t), e.defaultValue = t;
		}
		r ??= i, r = typeof r != "function" && typeof r != "symbol" && !!r, e.checked = s ? e.checked : !!r, e.defaultChecked = !!r, o != null && typeof o != "function" && typeof o != "symbol" && typeof o != "boolean" && (e.name = o), Dt(e);
	}
	function Pt(e, t, n) {
		t === "number" && kt(e.ownerDocument) === e || e.defaultValue === "" + n || (e.defaultValue = "" + n);
	}
	function Ft(e, t, n, r) {
		if (e = e.options, t) {
			t = {};
			for (var i = 0; i < n.length; i++) t["$" + n[i]] = !0;
			for (n = 0; n < e.length; n++) i = t.hasOwnProperty("$" + e[n].value), e[n].selected !== i && (e[n].selected = i), i && r && (e[n].defaultSelected = !0);
		} else {
			for (n = "" + wt(n), t = null, i = 0; i < e.length; i++) {
				if (e[i].value === n) {
					e[i].selected = !0, r && (e[i].defaultSelected = !0);
					return;
				}
				t !== null || e[i].disabled || (t = e[i]);
			}
			t !== null && (t.selected = !0);
		}
	}
	function It(e, t, n) {
		if (t != null && (t = "" + wt(t), t !== e.value && (e.value = t), n == null)) {
			e.defaultValue !== t && (e.defaultValue = t);
			return;
		}
		e.defaultValue = n == null ? "" : "" + wt(n);
	}
	function Lt(e, t, n, r) {
		if (t == null) {
			if (r != null) {
				if (n != null) throw Error(i(92));
				if (F(r)) {
					if (1 < r.length) throw Error(i(93));
					r = r[0];
				}
				n = r;
			}
			n ??= "", t = n;
		}
		n = wt(t), e.defaultValue = n, r = e.textContent, r === n && r !== "" && r !== null && (e.value = r), Dt(e);
	}
	function Rt(e, t) {
		if (t) {
			var n = e.firstChild;
			if (n && n === e.lastChild && n.nodeType === 3) {
				n.nodeValue = t;
				return;
			}
		}
		e.textContent = t;
	}
	var zt = new Set("animationIterationCount aspectRatio borderImageOutset borderImageSlice borderImageWidth boxFlex boxFlexGroup boxOrdinalGroup columnCount columns flex flexGrow flexPositive flexShrink flexNegative flexOrder gridArea gridRow gridRowEnd gridRowSpan gridRowStart gridColumn gridColumnEnd gridColumnSpan gridColumnStart fontWeight lineClamp lineHeight opacity order orphans scale tabSize widows zIndex zoom fillOpacity floodOpacity stopOpacity strokeDasharray strokeDashoffset strokeMiterlimit strokeOpacity strokeWidth MozAnimationIterationCount MozBoxFlex MozBoxFlexGroup MozLineClamp msAnimationIterationCount msFlex msZoom msFlexGrow msFlexNegative msFlexOrder msFlexPositive msFlexShrink msGridColumn msGridColumnSpan msGridRow msGridRowSpan WebkitAnimationIterationCount WebkitBoxFlex WebKitBoxFlexGroup WebkitBoxOrdinalGroup WebkitColumnCount WebkitColumns WebkitFlex WebkitFlexGrow WebkitFlexPositive WebkitFlexShrink WebkitLineClamp".split(" "));
	function Bt(e, t, n) {
		var r = t.indexOf("--") === 0;
		n == null || typeof n == "boolean" || n === "" ? r ? e.setProperty(t, "") : t === "float" ? e.cssFloat = "" : e[t] = "" : r ? e.setProperty(t, n) : typeof n != "number" || n === 0 || zt.has(t) ? t === "float" ? e.cssFloat = n : e[t] = ("" + n).trim() : e[t] = n + "px";
	}
	function Vt(e, t, n) {
		if (t != null && typeof t != "object") throw Error(i(62));
		if (e = e.style, n != null) {
			for (var r in n) !n.hasOwnProperty(r) || t != null && t.hasOwnProperty(r) || (r.indexOf("--") === 0 ? e.setProperty(r, "") : r === "float" ? e.cssFloat = "" : e[r] = "");
			for (var a in t) r = t[a], t.hasOwnProperty(a) && n[a] !== r && Bt(e, a, r);
		} else for (var o in t) t.hasOwnProperty(o) && Bt(e, o, t[o]);
	}
	function Ht(e) {
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
	var Ut = /* @__PURE__ */ new Map([
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
	]), Wt = /^[\u0000-\u001F ]*j[\r\n\t]*a[\r\n\t]*v[\r\n\t]*a[\r\n\t]*s[\r\n\t]*c[\r\n\t]*r[\r\n\t]*i[\r\n\t]*p[\r\n\t]*t[\r\n\t]*:/i;
	function Gt(e) {
		return Wt.test("" + e) ? "javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')" : e;
	}
	function Kt() {}
	var qt = null;
	function Jt(e) {
		return e = e.target || e.srcElement || window, e.correspondingUseElement && (e = e.correspondingUseElement), e.nodeType === 3 ? e.parentNode : e;
	}
	var Yt = null, Xt = null;
	function Zt(e) {
		var t = lt(e);
		if (t && (e = t.stateNode)) {
			var n = e[nt] || null;
			a: switch (e = t.stateNode, t.type) {
				case "input":
					if (Mt(e, n.value, n.defaultValue, n.defaultValue, n.checked, n.defaultChecked, n.type, n.name), t = n.name, n.type === "radio" && t != null) {
						for (n = e; n.parentNode;) n = n.parentNode;
						for (n = n.querySelectorAll("input[name=\"" + jt("" + t) + "\"][type=\"radio\"]"), t = 0; t < n.length; t++) {
							var r = n[t];
							if (r !== e && r.form === e.form) {
								var a = r[nt] || null;
								if (!a) throw Error(i(90));
								Mt(r, a.value, a.defaultValue, a.defaultValue, a.checked, a.defaultChecked, a.type, a.name);
							}
						}
						for (t = 0; t < n.length; t++) r = n[t], r.form === e.form && Ot(r);
					}
					break a;
				case "textarea":
					It(e, n.value, n.defaultValue);
					break a;
				case "select": t = n.value, t != null && Ft(e, !!n.multiple, t, !1);
			}
		}
	}
	var Qt = !1;
	function $t(e, t, n) {
		if (Qt) return e(t, n);
		Qt = !0;
		try {
			return e(t);
		} finally {
			if (Qt = !1, (Yt !== null || Xt !== null) && (vu(), Yt && (t = Yt, e = Xt, Xt = Yt = null, Zt(t), e))) for (t = 0; t < e.length; t++) Zt(e[t]);
		}
	}
	function en(e, t) {
		var n = e.stateNode;
		if (n === null) return null;
		var r = n[nt] || null;
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
	var tn = !(typeof window > "u" || window.document === void 0 || window.document.createElement === void 0), nn = !1;
	if (tn) try {
		var rn = {};
		Object.defineProperty(rn, "passive", { get: function() {
			nn = !0;
		} }), window.addEventListener("test", rn, rn), window.removeEventListener("test", rn, rn);
	} catch {
		nn = !1;
	}
	var an = null, on = null, sn = null;
	function cn() {
		if (sn) return sn;
		var e, t = on, n = t.length, r, i = "value" in an ? an.value : an.textContent, a = i.length;
		for (e = 0; e < n && t[e] === i[e]; e++);
		var o = n - e;
		for (r = 1; r <= o && t[n - r] === i[a - r]; r++);
		return sn = i.slice(e, 1 < r ? 1 - r : void 0);
	}
	function ln(e) {
		var t = e.keyCode;
		return "charCode" in e ? (e = e.charCode, e === 0 && t === 13 && (e = 13)) : e = t, e === 10 && (e = 13), 32 <= e || e === 13 ? e : 0;
	}
	function un() {
		return !0;
	}
	function dn() {
		return !1;
	}
	function fn(e) {
		function t(t, n, r, i, a) {
			for (var o in this._reactName = t, this._targetInst = r, this.type = n, this.nativeEvent = i, this.target = a, this.currentTarget = null, e) e.hasOwnProperty(o) && (t = e[o], this[o] = t ? t(i) : i[o]);
			return this.isDefaultPrevented = (i.defaultPrevented == null ? !1 === i.returnValue : i.defaultPrevented) ? un : dn, this.isPropagationStopped = dn, this;
		}
		return h(t.prototype, {
			preventDefault: function() {
				this.defaultPrevented = !0;
				var e = this.nativeEvent;
				e && (e.preventDefault ? e.preventDefault() : typeof e.returnValue != "unknown" && (e.returnValue = !1), this.isDefaultPrevented = un);
			},
			stopPropagation: function() {
				var e = this.nativeEvent;
				e && (e.stopPropagation ? e.stopPropagation() : typeof e.cancelBubble != "unknown" && (e.cancelBubble = !0), this.isPropagationStopped = un);
			},
			persist: function() {},
			isPersistent: un
		}), t;
	}
	var pn = {
		eventPhase: 0,
		bubbles: 0,
		cancelable: 0,
		timeStamp: function(e) {
			return e.timeStamp || Date.now();
		},
		defaultPrevented: 0,
		isTrusted: 0
	}, mn = fn(pn), hn = h({}, pn, {
		view: 0,
		detail: 0
	}), gn = fn(hn), _n, vn, yn, bn = h({}, hn, {
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
		getModifierState: jn,
		button: 0,
		buttons: 0,
		relatedTarget: function(e) {
			return e.relatedTarget === void 0 ? e.fromElement === e.srcElement ? e.toElement : e.fromElement : e.relatedTarget;
		},
		movementX: function(e) {
			return "movementX" in e ? e.movementX : (e !== yn && (yn && e.type === "mousemove" ? (_n = e.screenX - yn.screenX, vn = e.screenY - yn.screenY) : vn = _n = 0, yn = e), _n);
		},
		movementY: function(e) {
			return "movementY" in e ? e.movementY : vn;
		}
	}), xn = fn(bn), Sn = fn(h({}, bn, { dataTransfer: 0 })), Cn = fn(h({}, hn, { relatedTarget: 0 })), wn = fn(h({}, pn, {
		animationName: 0,
		elapsedTime: 0,
		pseudoElement: 0
	})), Tn = fn(h({}, pn, { clipboardData: function(e) {
		return "clipboardData" in e ? e.clipboardData : window.clipboardData;
	} })), En = fn(h({}, pn, { data: 0 })), Dn = {
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
	}, On = {
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
	}, kn = {
		Alt: "altKey",
		Control: "ctrlKey",
		Meta: "metaKey",
		Shift: "shiftKey"
	};
	function An(e) {
		var t = this.nativeEvent;
		return t.getModifierState ? t.getModifierState(e) : (e = kn[e]) ? !!t[e] : !1;
	}
	function jn() {
		return An;
	}
	var Mn = fn(h({}, hn, {
		key: function(e) {
			if (e.key) {
				var t = Dn[e.key] || e.key;
				if (t !== "Unidentified") return t;
			}
			return e.type === "keypress" ? (e = ln(e), e === 13 ? "Enter" : String.fromCharCode(e)) : e.type === "keydown" || e.type === "keyup" ? On[e.keyCode] || "Unidentified" : "";
		},
		code: 0,
		location: 0,
		ctrlKey: 0,
		shiftKey: 0,
		altKey: 0,
		metaKey: 0,
		repeat: 0,
		locale: 0,
		getModifierState: jn,
		charCode: function(e) {
			return e.type === "keypress" ? ln(e) : 0;
		},
		keyCode: function(e) {
			return e.type === "keydown" || e.type === "keyup" ? e.keyCode : 0;
		},
		which: function(e) {
			return e.type === "keypress" ? ln(e) : e.type === "keydown" || e.type === "keyup" ? e.keyCode : 0;
		}
	})), Nn = fn(h({}, bn, {
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
	})), Pn = fn(h({}, hn, {
		touches: 0,
		targetTouches: 0,
		changedTouches: 0,
		altKey: 0,
		metaKey: 0,
		ctrlKey: 0,
		shiftKey: 0,
		getModifierState: jn
	})), Fn = fn(h({}, pn, {
		propertyName: 0,
		elapsedTime: 0,
		pseudoElement: 0
	})), In = fn(h({}, bn, {
		deltaX: function(e) {
			return "deltaX" in e ? e.deltaX : "wheelDeltaX" in e ? -e.wheelDeltaX : 0;
		},
		deltaY: function(e) {
			return "deltaY" in e ? e.deltaY : "wheelDeltaY" in e ? -e.wheelDeltaY : "wheelDelta" in e ? -e.wheelDelta : 0;
		},
		deltaZ: 0,
		deltaMode: 0
	})), Ln = fn(h({}, pn, {
		newState: 0,
		oldState: 0
	})), Rn = [
		9,
		13,
		27,
		32
	], zn = tn && "CompositionEvent" in window, Bn = null;
	tn && "documentMode" in document && (Bn = document.documentMode);
	var Vn = tn && "TextEvent" in window && !Bn, Hn = tn && (!zn || Bn && 8 < Bn && 11 >= Bn), Un = " ", Wn = !1;
	function Gn(e, t) {
		switch (e) {
			case "keyup": return Rn.indexOf(t.keyCode) !== -1;
			case "keydown": return t.keyCode !== 229;
			case "keypress":
			case "mousedown":
			case "focusout": return !0;
			default: return !1;
		}
	}
	function Kn(e) {
		return e = e.detail, typeof e == "object" && "data" in e ? e.data : null;
	}
	var qn = !1;
	function Jn(e, t) {
		switch (e) {
			case "compositionend": return Kn(t);
			case "keypress": return t.which === 32 ? (Wn = !0, Un) : null;
			case "textInput": return e = t.data, e === Un && Wn ? null : e;
			default: return null;
		}
	}
	function Yn(e, t) {
		if (qn) return e === "compositionend" || !zn && Gn(e, t) ? (e = cn(), sn = on = an = null, qn = !1, e) : null;
		switch (e) {
			case "paste": return null;
			case "keypress":
				if (!(t.ctrlKey || t.altKey || t.metaKey) || t.ctrlKey && t.altKey) {
					if (t.char && 1 < t.char.length) return t.char;
					if (t.which) return String.fromCharCode(t.which);
				}
				return null;
			case "compositionend": return Hn && t.locale !== "ko" ? null : t.data;
			default: return null;
		}
	}
	var Xn = {
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
	function Zn(e) {
		var t = e && e.nodeName && e.nodeName.toLowerCase();
		return t === "input" ? !!Xn[e.type] : t === "textarea";
	}
	function Qn(e, t, n, r) {
		Yt ? Xt ? Xt.push(r) : Xt = [r] : Yt = r, t = Td(t, "onChange"), 0 < t.length && (n = new mn("onChange", "change", null, n, r), e.push({
			event: n,
			listeners: t
		}));
	}
	var $n = null, er = null;
	function tr(e) {
		vd(e, 0);
	}
	function nr(e) {
		if (Ot(ut(e))) return e;
	}
	function rr(e, t) {
		if (e === "change") return t;
	}
	var ir = !1;
	if (tn) {
		var ar;
		if (tn) {
			var or = "oninput" in document;
			if (!or) {
				var sr = document.createElement("div");
				sr.setAttribute("oninput", "return;"), or = typeof sr.oninput == "function";
			}
			ar = or;
		} else ar = !1;
		ir = ar && (!document.documentMode || 9 < document.documentMode);
	}
	function cr() {
		$n && ($n.detachEvent("onpropertychange", lr), er = $n = null);
	}
	function lr(e) {
		if (e.propertyName === "value" && nr(er)) {
			var t = [];
			Qn(t, er, e, Jt(e)), $t(tr, t);
		}
	}
	function ur(e, t, n) {
		e === "focusin" ? (cr(), $n = t, er = n, $n.attachEvent("onpropertychange", lr)) : e === "focusout" && cr();
	}
	function dr(e) {
		if (e === "selectionchange" || e === "keyup" || e === "keydown") return nr(er);
	}
	function fr(e, t) {
		if (e === "click") return nr(t);
	}
	function pr(e, t) {
		if (e === "input" || e === "change") return nr(t);
	}
	function mr(e, t) {
		return e === t && (e !== 0 || 1 / e == 1 / t) || e !== e && t !== t;
	}
	var hr = typeof Object.is == "function" ? Object.is : mr;
	function gr(e, t) {
		if (hr(e, t)) return !0;
		if (typeof e != "object" || !e || typeof t != "object" || !t) return !1;
		var n = Object.keys(e), r = Object.keys(t);
		if (n.length !== r.length) return !1;
		for (r = 0; r < n.length; r++) {
			var i = n[r];
			if (!_e.call(t, i) || !hr(e[i], t[i])) return !1;
		}
		return !0;
	}
	function _r(e) {
		for (; e && e.firstChild;) e = e.firstChild;
		return e;
	}
	function vr(e, t) {
		var n = _r(e);
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
			n = _r(n);
		}
	}
	function yr(e, t) {
		return e && t ? e === t ? !0 : e && e.nodeType === 3 ? !1 : t && t.nodeType === 3 ? yr(e, t.parentNode) : "contains" in e ? e.contains(t) : e.compareDocumentPosition ? !!(e.compareDocumentPosition(t) & 16) : !1 : !1;
	}
	function br(e) {
		e = e != null && e.ownerDocument != null && e.ownerDocument.defaultView != null ? e.ownerDocument.defaultView : window;
		for (var t = kt(e.document); t instanceof e.HTMLIFrameElement;) {
			try {
				var n = typeof t.contentWindow.location.href == "string";
			} catch {
				n = !1;
			}
			if (n) e = t.contentWindow;
			else break;
			t = kt(e.document);
		}
		return t;
	}
	function xr(e) {
		var t = e && e.nodeName && e.nodeName.toLowerCase();
		return t && (t === "input" && (e.type === "text" || e.type === "search" || e.type === "tel" || e.type === "url" || e.type === "password") || t === "textarea" || e.contentEditable === "true");
	}
	var Sr = tn && "documentMode" in document && 11 >= document.documentMode, Cr = null, wr = null, Tr = null, Er = !1;
	function Dr(e, t, n) {
		var r = n.window === n ? n.document : n.nodeType === 9 ? n : n.ownerDocument;
		Er || Cr == null || Cr !== kt(r) || (r = Cr, "selectionStart" in r && xr(r) ? r = {
			start: r.selectionStart,
			end: r.selectionEnd
		} : (r = (r.ownerDocument && r.ownerDocument.defaultView || window).getSelection(), r = {
			anchorNode: r.anchorNode,
			anchorOffset: r.anchorOffset,
			focusNode: r.focusNode,
			focusOffset: r.focusOffset
		}), Tr && gr(Tr, r) || (Tr = r, r = Td(wr, "onSelect"), 0 < r.length && (t = new mn("onSelect", "select", null, t, n), e.push({
			event: t,
			listeners: r
		}), t.target = Cr)));
	}
	function Or(e, t) {
		var n = {};
		return n[e.toLowerCase()] = t.toLowerCase(), n["Webkit" + e] = "webkit" + t, n["Moz" + e] = "moz" + t, n;
	}
	var kr = {
		animationend: Or("Animation", "AnimationEnd"),
		animationiteration: Or("Animation", "AnimationIteration"),
		animationstart: Or("Animation", "AnimationStart"),
		transitionrun: Or("Transition", "TransitionRun"),
		transitionstart: Or("Transition", "TransitionStart"),
		transitioncancel: Or("Transition", "TransitionCancel"),
		transitionend: Or("Transition", "TransitionEnd")
	}, K = {}, Ar = {};
	tn && (Ar = document.createElement("div").style, "AnimationEvent" in window || (delete kr.animationend.animation, delete kr.animationiteration.animation, delete kr.animationstart.animation), "TransitionEvent" in window || delete kr.transitionend.transition);
	function jr(e) {
		if (K[e]) return K[e];
		if (!kr[e]) return e;
		var t = kr[e], n;
		for (n in t) if (t.hasOwnProperty(n) && n in Ar) return K[e] = t[n];
		return e;
	}
	var Mr = jr("animationend"), Nr = jr("animationiteration"), Pr = jr("animationstart"), Fr = jr("transitionrun"), q = jr("transitionstart"), Ir = jr("transitioncancel"), Lr = jr("transitionend"), Rr = /* @__PURE__ */ new Map(), zr = "abort auxClick beforeToggle cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(" ");
	zr.push("scrollEnd");
	function Br(e, t) {
		Rr.set(e, t), ht(t, [e]);
	}
	var Vr = typeof reportError == "function" ? reportError : function(e) {
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
	}, Hr = [], Ur = 0, Wr = 0;
	function Gr() {
		for (var e = Ur, t = Wr = Ur = 0; t < e;) {
			var n = Hr[t];
			Hr[t++] = null;
			var r = Hr[t];
			Hr[t++] = null;
			var i = Hr[t];
			Hr[t++] = null;
			var a = Hr[t];
			if (Hr[t++] = null, r !== null && i !== null) {
				var o = r.pending;
				o === null ? i.next = i : (i.next = o.next, o.next = i), r.pending = i;
			}
			a !== 0 && Yr(n, i, a);
		}
	}
	function Kr(e, t, n, r) {
		Hr[Ur++] = e, Hr[Ur++] = t, Hr[Ur++] = n, Hr[Ur++] = r, Wr |= r, e.lanes |= r, e = e.alternate, e !== null && (e.lanes |= r);
	}
	function qr(e, t, n, r) {
		return Kr(e, t, n, r), Xr(e);
	}
	function Jr(e, t) {
		return Kr(e, null, null, t), Xr(e);
	}
	function Yr(e, t, n) {
		e.lanes |= n;
		var r = e.alternate;
		r !== null && (r.lanes |= n);
		for (var i = !1, a = e.return; a !== null;) a.childLanes |= n, r = a.alternate, r !== null && (r.childLanes |= n), a.tag === 22 && (e = a.stateNode, e === null || e._visibility & 1 || (i = !0)), e = a, a = a.return;
		return e.tag === 3 ? (a = e.stateNode, i && t !== null && (i = 31 - U(n), e = a.hiddenUpdates, r = e[i], r === null ? e[i] = [t] : r.push(t), t.lane = n | 536870912), a) : null;
	}
	function Xr(e) {
		if (50 < lu) throw lu = 0, uu = null, Error(i(185));
		for (var t = e.return; t !== null;) e = t, t = e.return;
		return e.tag === 3 ? e.stateNode : null;
	}
	var Zr = {};
	function Qr(e, t, n, r) {
		this.tag = e, this.key = n, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.refCleanup = this.ref = null, this.pendingProps = t, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = r, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null;
	}
	function $r(e, t, n, r) {
		return new Qr(e, t, n, r);
	}
	function ei(e) {
		return e = e.prototype, !(!e || !e.isReactComponent);
	}
	function ti(e, t) {
		var n = e.alternate;
		return n === null ? (n = $r(e.tag, t, e.key, e.mode), n.elementType = e.elementType, n.type = e.type, n.stateNode = e.stateNode, n.alternate = e, e.alternate = n) : (n.pendingProps = t, n.type = e.type, n.flags = 0, n.subtreeFlags = 0, n.deletions = null), n.flags = e.flags & 65011712, n.childLanes = e.childLanes, n.lanes = e.lanes, n.child = e.child, n.memoizedProps = e.memoizedProps, n.memoizedState = e.memoizedState, n.updateQueue = e.updateQueue, t = e.dependencies, n.dependencies = t === null ? null : {
			lanes: t.lanes,
			firstContext: t.firstContext
		}, n.sibling = e.sibling, n.index = e.index, n.ref = e.ref, n.refCleanup = e.refCleanup, n;
	}
	function ni(e, t) {
		e.flags &= 65011714;
		var n = e.alternate;
		return n === null ? (e.childLanes = 0, e.lanes = t, e.child = null, e.subtreeFlags = 0, e.memoizedProps = null, e.memoizedState = null, e.updateQueue = null, e.dependencies = null, e.stateNode = null) : (e.childLanes = n.childLanes, e.lanes = n.lanes, e.child = n.child, e.subtreeFlags = 0, e.deletions = null, e.memoizedProps = n.memoizedProps, e.memoizedState = n.memoizedState, e.updateQueue = n.updateQueue, e.type = n.type, t = n.dependencies, e.dependencies = t === null ? null : {
			lanes: t.lanes,
			firstContext: t.firstContext
		}), e;
	}
	function ri(e, t, n, r, a, o) {
		var s = 0;
		if (r = e, typeof e == "function") ei(e) && (s = 1);
		else if (typeof e == "string") s = Uf(e, n, ne.current) ? 26 : e === "html" || e === "head" || e === "body" ? 27 : 5;
		else a: switch (e) {
			case k: return e = $r(31, n, t, a), e.elementType = k, e.lanes = o, e;
			case y: return ii(n.children, a, o, t);
			case b:
				s = 8, a |= 24;
				break;
			case x: return e = $r(12, n, t, a | 2), e.elementType = x, e.lanes = o, e;
			case T: return e = $r(13, n, t, a), e.elementType = T, e.lanes = o, e;
			case E: return e = $r(19, n, t, a), e.elementType = E, e.lanes = o, e;
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
					case D:
						s = 14;
						break a;
					case O:
						s = 16, r = null;
						break a;
				}
				s = 29, n = Error(i(130, e === null ? "null" : typeof e, "")), r = null;
		}
		return t = $r(s, n, t, a), t.elementType = e, t.type = r, t.lanes = o, t;
	}
	function ii(e, t, n, r) {
		return e = $r(7, e, r, t), e.lanes = n, e;
	}
	function ai(e, t, n) {
		return e = $r(6, e, null, t), e.lanes = n, e;
	}
	function oi(e) {
		var t = $r(18, null, null, 0);
		return t.stateNode = e, t;
	}
	function si(e, t, n) {
		return t = $r(4, e.children === null ? [] : e.children, e.key, t), t.lanes = n, t.stateNode = {
			containerInfo: e.containerInfo,
			pendingChildren: null,
			implementation: e.implementation
		}, t;
	}
	var ci = /* @__PURE__ */ new WeakMap();
	function li(e, t) {
		if (typeof e == "object" && e) {
			var n = ci.get(e);
			return n === void 0 ? (t = {
				value: e,
				source: t,
				stack: ge(t)
			}, ci.set(e, t), t) : n;
		}
		return {
			value: e,
			source: t,
			stack: ge(t)
		};
	}
	var ui = [], di = 0, fi = null, pi = 0, mi = [], hi = 0, gi = null, _i = 1, vi = "";
	function yi(e, t) {
		ui[di++] = pi, ui[di++] = fi, fi = e, pi = t;
	}
	function bi(e, t, n) {
		mi[hi++] = _i, mi[hi++] = vi, mi[hi++] = gi, gi = e;
		var r = _i;
		e = vi;
		var i = 32 - U(r) - 1;
		r &= ~(1 << i), n += 1;
		var a = 32 - U(t) + i;
		if (30 < a) {
			var o = i - i % 5;
			a = (r & (1 << o) - 1).toString(32), r >>= o, i -= o, _i = 1 << 32 - U(t) + i | n << i | r, vi = a + e;
		} else _i = 1 << a | n << i | r, vi = e;
	}
	function xi(e) {
		e.return !== null && (yi(e, 1), bi(e, 1, 0));
	}
	function Si(e) {
		for (; e === fi;) fi = ui[--di], ui[di] = null, pi = ui[--di], ui[di] = null;
		for (; e === gi;) gi = mi[--hi], mi[hi] = null, vi = mi[--hi], mi[hi] = null, _i = mi[--hi], mi[hi] = null;
	}
	function Ci(e, t) {
		mi[hi++] = _i, mi[hi++] = vi, mi[hi++] = gi, _i = t.id, vi = t.overflow, gi = e;
	}
	var wi = null, Ti = null, J = !1, Ei = null, Di = !1, Oi = Error(i(519));
	function ki(e) {
		throw Fi(li(Error(i(418, 1 < arguments.length && arguments[1] !== void 0 && arguments[1] ? "text" : "HTML", "")), e)), Oi;
	}
	function Ai(e) {
		var t = e.stateNode, n = e.type, r = e.memoizedProps;
		switch (t[tt] = e, t[nt] = r, n) {
			case "dialog":
				$("cancel", t), $("close", t);
				break;
			case "iframe":
			case "object":
			case "embed":
				$("load", t);
				break;
			case "video":
			case "audio":
				for (n = 0; n < gd.length; n++) $(gd[n], t);
				break;
			case "source":
				$("error", t);
				break;
			case "img":
			case "image":
			case "link":
				$("error", t), $("load", t);
				break;
			case "details":
				$("toggle", t);
				break;
			case "input":
				$("invalid", t), Nt(t, r.value, r.defaultValue, r.checked, r.defaultChecked, r.type, r.name, !0);
				break;
			case "select":
				$("invalid", t);
				break;
			case "textarea": $("invalid", t), Lt(t, r.value, r.defaultValue, r.children);
		}
		n = r.children, typeof n != "string" && typeof n != "number" && typeof n != "bigint" || t.textContent === "" + n || !0 === r.suppressHydrationWarning || jd(t.textContent, n) ? (r.popover != null && ($("beforetoggle", t), $("toggle", t)), r.onScroll != null && $("scroll", t), r.onScrollEnd != null && $("scrollend", t), r.onClick != null && (t.onclick = Kt), t = !0) : t = !1, t || ki(e, !0);
	}
	function ji(e) {
		for (wi = e.return; wi;) switch (wi.tag) {
			case 5:
			case 31:
			case 13:
				Di = !1;
				return;
			case 27:
			case 3:
				Di = !0;
				return;
			default: wi = wi.return;
		}
	}
	function Mi(e) {
		if (e !== wi) return !1;
		if (!J) return ji(e), J = !0, !1;
		var t = e.tag, n;
		if ((n = t !== 3 && t !== 27) && ((n = t === 5) && (n = e.type, n = !(n !== "form" && n !== "button") || Ud(e.type, e.memoizedProps)), n = !n), n && Ti && ki(e), ji(e), t === 13) {
			if (e = e.memoizedState, e = e === null ? null : e.dehydrated, !e) throw Error(i(317));
			Ti = uf(e);
		} else if (t === 31) {
			if (e = e.memoizedState, e = e === null ? null : e.dehydrated, !e) throw Error(i(317));
			Ti = uf(e);
		} else t === 27 ? (t = Ti, Zd(e.type) ? (e = lf, lf = null, Ti = e) : Ti = t) : Ti = wi ? cf(e.stateNode.nextSibling) : null;
		return !0;
	}
	function Ni() {
		Ti = wi = null, J = !1;
	}
	function Pi() {
		var e = Ei;
		return e !== null && (Yl === null ? Yl = e : Yl.push.apply(Yl, e), Ei = null), e;
	}
	function Fi(e) {
		Ei === null ? Ei = [e] : Ei.push(e);
	}
	var Ii = te(null), Li = null, Ri = null;
	function zi(e, t, n) {
		V(Ii, t._currentValue), t._currentValue = n;
	}
	function Bi(e) {
		e._currentValue = Ii.current, B(Ii);
	}
	function Vi(e, t, n) {
		for (; e !== null;) {
			var r = e.alternate;
			if ((e.childLanes & t) === t ? r !== null && (r.childLanes & t) !== t && (r.childLanes |= t) : (e.childLanes |= t, r !== null && (r.childLanes |= t)), e === n) break;
			e = e.return;
		}
	}
	function Hi(e, t, n, r) {
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
						o.lanes |= n, c = o.alternate, c !== null && (c.lanes |= n), Vi(o.return, n, e), r || (s = null);
						break a;
					}
					o = c.next;
				}
			} else if (a.tag === 18) {
				if (s = a.return, s === null) throw Error(i(341));
				s.lanes |= n, o = s.alternate, o !== null && (o.lanes |= n), Vi(s, n, e), s = null;
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
	function Ui(e, t, n, r) {
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
					hr(a.pendingProps.value, s.value) || (e === null ? e = [c] : e.push(c));
				}
			} else if (a === ae.current) {
				if (s = a.alternate, s === null) throw Error(i(387));
				s.memoizedState.memoizedState !== a.memoizedState.memoizedState && (e === null ? e = [Qf] : e.push(Qf));
			}
			a = a.return;
		}
		e !== null && Hi(t, e, n, r), t.flags |= 262144;
	}
	function Wi(e) {
		for (e = e.firstContext; e !== null;) {
			if (!hr(e.context._currentValue, e.memoizedValue)) return !0;
			e = e.next;
		}
		return !1;
	}
	function Gi(e) {
		Li = e, Ri = null, e = e.dependencies, e !== null && (e.firstContext = null);
	}
	function Ki(e) {
		return Ji(Li, e);
	}
	function qi(e, t) {
		return Li === null && Gi(e), Ji(e, t);
	}
	function Ji(e, t) {
		var n = t._currentValue;
		if (t = {
			context: t,
			memoizedValue: n,
			next: null
		}, Ri === null) {
			if (e === null) throw Error(i(308));
			Ri = t, e.dependencies = {
				lanes: 0,
				firstContext: t
			}, e.flags |= 524288;
		} else Ri = Ri.next = t;
		return n;
	}
	var Yi = typeof AbortController < "u" ? AbortController : function() {
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
	}, Xi = t.unstable_scheduleCallback, Zi = t.unstable_NormalPriority, Qi = {
		$$typeof: C,
		Consumer: null,
		Provider: null,
		_currentValue: null,
		_currentValue2: null,
		_threadCount: 0
	};
	function $i() {
		return {
			controller: new Yi(),
			data: /* @__PURE__ */ new Map(),
			refCount: 0
		};
	}
	function ea(e) {
		e.refCount--, e.refCount === 0 && Xi(Zi, function() {
			e.controller.abort();
		});
	}
	var ta = null, na = 0, ra = 0, ia = null;
	function aa(e, t) {
		if (ta === null) {
			var n = ta = [];
			na = 0, ra = ud(), ia = {
				status: "pending",
				value: void 0,
				then: function(e) {
					n.push(e);
				}
			};
		}
		return na++, t.then(oa, oa), t;
	}
	function oa() {
		if (--na === 0 && ta !== null) {
			ia !== null && (ia.status = "fulfilled");
			var e = ta;
			ta = null, ra = 0, ia = null;
			for (var t = 0; t < e.length; t++) (0, e[t])();
		}
	}
	function sa(e, t) {
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
	var ca = I.S;
	I.S = function(e, t) {
		Ql = H(), typeof t == "object" && t && typeof t.then == "function" && aa(e, t), ca !== null && ca(e, t);
	};
	var la = te(null);
	function ua() {
		var e = la.current;
		return e === null ? Fl.pooledCache : e;
	}
	function da(e, t) {
		t === null ? V(la, la.current) : V(la, t.pool);
	}
	function fa() {
		var e = ua();
		return e === null ? null : {
			parent: Qi._currentValue,
			pool: e
		};
	}
	var pa = Error(i(460)), ma = Error(i(474)), ha = Error(i(542)), ga = { then: function() {} };
	function _a(e) {
		return e = e.status, e === "fulfilled" || e === "rejected";
	}
	function va(e, t, n) {
		switch (n = e[n], n === void 0 ? e.push(t) : n !== t && (t.then(Kt, Kt), t = n), t.status) {
			case "fulfilled": return t.value;
			case "rejected": throw e = t.reason, Sa(e), e;
			default:
				if (typeof t.status == "string") t.then(Kt, Kt);
				else {
					if (e = Fl, e !== null && 100 < e.shellSuspendCounter) throw Error(i(482));
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
					case "rejected": throw e = t.reason, Sa(e), e;
				}
				throw ba = t, pa;
		}
	}
	function ya(e) {
		try {
			var t = e._init;
			return t(e._payload);
		} catch (e) {
			throw typeof e == "object" && e && typeof e.then == "function" ? (ba = e, pa) : e;
		}
	}
	var ba = null;
	function xa() {
		if (ba === null) throw Error(i(459));
		var e = ba;
		return ba = null, e;
	}
	function Sa(e) {
		if (e === pa || e === ha) throw Error(i(483));
	}
	var Ca = null, wa = 0;
	function Ta(e) {
		var t = wa;
		return wa += 1, Ca === null && (Ca = []), va(Ca, e, t);
	}
	function Ea(e, t) {
		t = t.props.ref, e.ref = t === void 0 ? null : t;
	}
	function Da(e, t) {
		throw t.$$typeof === g ? Error(i(525)) : (e = Object.prototype.toString.call(t), Error(i(31, e === "[object Object]" ? "object with keys {" + Object.keys(t).join(", ") + "}" : e)));
	}
	function Oa(e) {
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
			return e = ti(e, t), e.index = 0, e.sibling = null, e;
		}
		function o(t, n, r) {
			return t.index = r, e ? (r = t.alternate, r === null ? (t.flags |= 67108866, n) : (r = r.index, r < n ? (t.flags |= 67108866, n) : r)) : (t.flags |= 1048576, n);
		}
		function s(t) {
			return e && t.alternate === null && (t.flags |= 67108866), t;
		}
		function c(e, t, n, r) {
			return t === null || t.tag !== 6 ? (t = ai(n, e.mode, r), t.return = e, t) : (t = a(t, n), t.return = e, t);
		}
		function l(e, t, n, r) {
			var i = n.type;
			return i === y ? d(e, t, n.props.children, r, n.key) : t !== null && (t.elementType === i || typeof i == "object" && i && i.$$typeof === O && ya(i) === t.type) ? (t = a(t, n.props), Ea(t, n), t.return = e, t) : (t = ri(n.type, n.key, n.props, null, e.mode, r), Ea(t, n), t.return = e, t);
		}
		function u(e, t, n, r) {
			return t === null || t.tag !== 4 || t.stateNode.containerInfo !== n.containerInfo || t.stateNode.implementation !== n.implementation ? (t = si(n, e.mode, r), t.return = e, t) : (t = a(t, n.children || []), t.return = e, t);
		}
		function d(e, t, n, r, i) {
			return t === null || t.tag !== 7 ? (t = ii(n, e.mode, r, i), t.return = e, t) : (t = a(t, n), t.return = e, t);
		}
		function f(e, t, n) {
			if (typeof t == "string" && t !== "" || typeof t == "number" || typeof t == "bigint") return t = ai("" + t, e.mode, n), t.return = e, t;
			if (typeof t == "object" && t) {
				switch (t.$$typeof) {
					case _: return n = ri(t.type, t.key, t.props, null, e.mode, n), Ea(n, t), n.return = e, n;
					case v: return t = si(t, e.mode, n), t.return = e, t;
					case O: return t = ya(t), f(e, t, n);
				}
				if (F(t) || M(t)) return t = ii(t, e.mode, n, null), t.return = e, t;
				if (typeof t.then == "function") return f(e, Ta(t), n);
				if (t.$$typeof === C) return f(e, qi(e, t), n);
				Da(e, t);
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
					case O: return n = ya(n), p(e, t, n, r);
				}
				if (F(n) || M(n)) return i === null ? d(e, t, n, r, null) : null;
				if (typeof n.then == "function") return p(e, t, Ta(n), r);
				if (n.$$typeof === C) return p(e, t, qi(e, n), r);
				Da(e, n);
			}
			return null;
		}
		function m(e, t, n, r, i) {
			if (typeof r == "string" && r !== "" || typeof r == "number" || typeof r == "bigint") return e = e.get(n) || null, c(t, e, "" + r, i);
			if (typeof r == "object" && r) {
				switch (r.$$typeof) {
					case _: return e = e.get(r.key === null ? n : r.key) || null, l(t, e, r, i);
					case v: return e = e.get(r.key === null ? n : r.key) || null, u(t, e, r, i);
					case O: return r = ya(r), m(e, t, n, r, i);
				}
				if (F(r) || M(r)) return e = e.get(n) || null, d(t, e, r, i, null);
				if (typeof r.then == "function") return m(e, t, n, Ta(r), i);
				if (r.$$typeof === C) return m(e, t, n, qi(t, r), i);
				Da(t, r);
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
			if (h === s.length) return n(i, d), J && yi(i, h), l;
			if (d === null) {
				for (; h < s.length; h++) d = f(i, s[h], c), d !== null && (a = o(d, a, h), u === null ? l = d : u.sibling = d, u = d);
				return J && yi(i, h), l;
			}
			for (d = r(d); h < s.length; h++) g = m(d, i, h, s[h], c), g !== null && (e && g.alternate !== null && d.delete(g.key === null ? h : g.key), a = o(g, a, h), u === null ? l = g : u.sibling = g, u = g);
			return e && d.forEach(function(e) {
				return t(i, e);
			}), J && yi(i, h), l;
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
			if (v.done) return n(a, h), J && yi(a, g), u;
			if (h === null) {
				for (; !v.done; g++, v = c.next()) v = f(a, v.value, l), v !== null && (s = o(v, s, g), d === null ? u = v : d.sibling = v, d = v);
				return J && yi(a, g), u;
			}
			for (h = r(h); !v.done; g++, v = c.next()) v = m(h, a, g, v.value, l), v !== null && (e && v.alternate !== null && h.delete(v.key === null ? g : v.key), s = o(v, s, g), d === null ? u = v : d.sibling = v, d = v);
			return e && h.forEach(function(e) {
				return t(a, e);
			}), J && yi(a, g), u;
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
									} else if (r.elementType === l || typeof l == "object" && l && l.$$typeof === O && ya(l) === r.type) {
										n(e, r.sibling), c = a(r, o.props), Ea(c, o), c.return = e, e = c;
										break a;
									}
									n(e, r);
									break;
								} else t(e, r);
								r = r.sibling;
							}
							o.type === y ? (c = ii(o.props.children, e.mode, c, o.key), c.return = e, e = c) : (c = ri(o.type, o.key, o.props, null, e.mode, c), Ea(c, o), c.return = e, e = c);
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
							c = si(o, e.mode, c), c.return = e, e = c;
						}
						return s(e);
					case O: return o = ya(o), b(e, r, o, c);
				}
				if (F(o)) return h(e, r, o, c);
				if (M(o)) {
					if (l = M(o), typeof l != "function") throw Error(i(150));
					return o = l.call(o), g(e, r, o, c);
				}
				if (typeof o.then == "function") return b(e, r, Ta(o), c);
				if (o.$$typeof === C) return b(e, r, qi(e, o), c);
				Da(e, o);
			}
			return typeof o == "string" && o !== "" || typeof o == "number" || typeof o == "bigint" ? (o = "" + o, r !== null && r.tag === 6 ? (n(e, r.sibling), c = a(r, o), c.return = e, e = c) : (n(e, r), c = ai(o, e.mode, c), c.return = e, e = c), s(e)) : n(e, r);
		}
		return function(e, t, n, r) {
			try {
				wa = 0;
				var i = b(e, t, n, r);
				return Ca = null, i;
			} catch (t) {
				if (t === pa || t === ha) throw t;
				var a = $r(29, t, null, e.mode);
				return a.lanes = r, a.return = e, a;
			}
		};
	}
	var ka = Oa(!0), Aa = Oa(!1), ja = !1;
	function Ma(e) {
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
	function Na(e, t) {
		e = e.updateQueue, t.updateQueue === e && (t.updateQueue = {
			baseState: e.baseState,
			firstBaseUpdate: e.firstBaseUpdate,
			lastBaseUpdate: e.lastBaseUpdate,
			shared: e.shared,
			callbacks: null
		});
	}
	function Pa(e) {
		return {
			lane: e,
			tag: 0,
			payload: null,
			callback: null,
			next: null
		};
	}
	function Fa(e, t, n) {
		var r = e.updateQueue;
		if (r === null) return null;
		if (r = r.shared, X & 2) {
			var i = r.pending;
			return i === null ? t.next = t : (t.next = i.next, i.next = t), r.pending = t, t = Xr(e), Yr(e, null, n), t;
		}
		return Kr(e, r, t, n), Xr(e);
	}
	function Ia(e, t, n) {
		if (t = t.updateQueue, t !== null && (t = t.shared, n & 4194048)) {
			var r = t.lanes;
			r &= e.pendingLanes, n |= r, t.lanes = n, Je(e, n);
		}
	}
	function La(e, t) {
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
	var Ra = !1;
	function za() {
		if (Ra) {
			var e = ia;
			if (e !== null) throw e;
		}
	}
	function Ba(e, t, n, r) {
		Ra = !1;
		var i = e.updateQueue;
		ja = !1;
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
				if (p ? (Q & f) === f : (r & f) === f) {
					f !== 0 && f === ra && (Ra = !0), u !== null && (u = u.next = {
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
							case 2: ja = !0;
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
			u === null && (c = d), i.baseState = c, i.firstBaseUpdate = l, i.lastBaseUpdate = u, a === null && (i.shared.lanes = 0), Ul |= o, e.lanes = o, e.memoizedState = d;
		}
	}
	function Va(e, t) {
		if (typeof e != "function") throw Error(i(191, e));
		e.call(t);
	}
	function Ha(e, t) {
		var n = e.callbacks;
		if (n !== null) for (e.callbacks = null, e = 0; e < n.length; e++) Va(n[e], t);
	}
	var Ua = te(null), Wa = te(0);
	function Ga(e, t) {
		e = Vl, V(Wa, e), V(Ua, t), Vl = e | t.baseLanes;
	}
	function Ka() {
		V(Wa, Vl), V(Ua, Ua.current);
	}
	function qa() {
		Vl = Wa.current, B(Ua), B(Wa);
	}
	var Ja = te(null), Ya = null;
	function Xa(e) {
		var t = e.alternate;
		V(to, to.current & 1), V(Ja, e), Ya === null && (t === null || Ua.current !== null || t.memoizedState !== null) && (Ya = e);
	}
	function Za(e) {
		V(to, to.current), V(Ja, e), Ya === null && (Ya = e);
	}
	function Qa(e) {
		e.tag === 22 ? (V(to, to.current), V(Ja, e), Ya === null && (Ya = e)) : $a(e);
	}
	function $a() {
		V(to, to.current), V(Ja, Ja.current);
	}
	function eo(e) {
		B(Ja), Ya === e && (Ya = null), B(to);
	}
	var to = te(0);
	function no(e) {
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
	var ro = 0, Y = null, io = null, ao = null, oo = !1, so = !1, co = !1, lo = 0, uo = 0, fo = null, po = 0;
	function mo() {
		throw Error(i(321));
	}
	function ho(e, t) {
		if (t === null) return !1;
		for (var n = 0; n < t.length && n < e.length; n++) if (!hr(e[n], t[n])) return !1;
		return !0;
	}
	function go(e, t, n, r, i, a) {
		return ro = a, Y = t, t.memoizedState = null, t.updateQueue = null, t.lanes = 0, I.H = e === null || e.memoizedState === null ? Ns : Ps, co = !1, a = n(r, i), co = !1, so && (a = vo(t, n, r, i)), _o(e), a;
	}
	function _o(e) {
		I.H = Ms;
		var t = io !== null && io.next !== null;
		if (ro = 0, ao = io = Y = null, oo = !1, uo = 0, fo = null, t) throw Error(i(300));
		e === null || Zs || (e = e.dependencies, e !== null && Wi(e) && (Zs = !0));
	}
	function vo(e, t, n, r) {
		Y = e;
		var a = 0;
		do {
			if (so && (fo = null), uo = 0, so = !1, 25 <= a) throw Error(i(301));
			if (a += 1, ao = io = null, e.updateQueue != null) {
				var o = e.updateQueue;
				o.lastEffect = null, o.events = null, o.stores = null, o.memoCache != null && (o.memoCache.index = 0);
			}
			I.H = Fs, o = t(n, r);
		} while (so);
		return o;
	}
	function yo() {
		var e = I.H, t = e.useState()[0];
		return t = typeof t.then == "function" ? Eo(t) : t, e = e.useState()[0], (io === null ? null : io.memoizedState) !== e && (Y.flags |= 1024), t;
	}
	function bo() {
		var e = lo !== 0;
		return lo = 0, e;
	}
	function xo(e, t, n) {
		t.updateQueue = e.updateQueue, t.flags &= -2053, e.lanes &= ~n;
	}
	function So(e) {
		if (oo) {
			for (e = e.memoizedState; e !== null;) {
				var t = e.queue;
				t !== null && (t.pending = null), e = e.next;
			}
			oo = !1;
		}
		ro = 0, ao = io = Y = null, so = !1, uo = lo = 0, fo = null;
	}
	function Co() {
		var e = {
			memoizedState: null,
			baseState: null,
			baseQueue: null,
			queue: null,
			next: null
		};
		return ao === null ? Y.memoizedState = ao = e : ao = ao.next = e, ao;
	}
	function wo() {
		if (io === null) {
			var e = Y.alternate;
			e = e === null ? null : e.memoizedState;
		} else e = io.next;
		var t = ao === null ? Y.memoizedState : ao.next;
		if (t !== null) ao = t, io = e;
		else {
			if (e === null) throw Y.alternate === null ? Error(i(467)) : Error(i(310));
			io = e, e = {
				memoizedState: io.memoizedState,
				baseState: io.baseState,
				baseQueue: io.baseQueue,
				queue: io.queue,
				next: null
			}, ao === null ? Y.memoizedState = ao = e : ao = ao.next = e;
		}
		return ao;
	}
	function To() {
		return {
			lastEffect: null,
			events: null,
			stores: null,
			memoCache: null
		};
	}
	function Eo(e) {
		var t = uo;
		return uo += 1, fo === null && (fo = []), e = va(fo, e, t), t = Y, (ao === null ? t.memoizedState : ao.next) === null && (t = t.alternate, I.H = t === null || t.memoizedState === null ? Ns : Ps), e;
	}
	function Do(e) {
		if (typeof e == "object" && e) {
			if (typeof e.then == "function") return Eo(e);
			if (e.$$typeof === C) return Ki(e);
		}
		throw Error(i(438, String(e)));
	}
	function Oo(e) {
		var t = null, n = Y.updateQueue;
		if (n !== null && (t = n.memoCache), t == null) {
			var r = Y.alternate;
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
		}, n === null && (n = To(), Y.updateQueue = n), n.memoCache = t, n = t.data[t.index], n === void 0) for (n = t.data[t.index] = Array(e), r = 0; r < e; r++) n[r] = A;
		return t.index++, n;
	}
	function ko(e, t) {
		return typeof t == "function" ? t(e) : t;
	}
	function Ao(e) {
		return jo(wo(), io, e);
	}
	function jo(e, t, n) {
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
				if (f === u.lane ? (ro & f) === f : (Q & f) === f) {
					var p = u.revertLane;
					if (p === 0) l !== null && (l = l.next = {
						lane: 0,
						revertLane: 0,
						gesture: null,
						action: u.action,
						hasEagerState: u.hasEagerState,
						eagerState: u.eagerState,
						next: null
					}), f === ra && (d = !0);
					else if ((ro & p) === p) {
						u = u.next, p === ra && (d = !0);
						continue;
					} else f = {
						lane: 0,
						revertLane: u.revertLane,
						gesture: null,
						action: u.action,
						hasEagerState: u.hasEagerState,
						eagerState: u.eagerState,
						next: null
					}, l === null ? (c = l = f, s = o) : l = l.next = f, Y.lanes |= p, Ul |= p;
					f = u.action, co && n(o, f), o = u.hasEagerState ? u.eagerState : n(o, f);
				} else p = {
					lane: f,
					revertLane: u.revertLane,
					gesture: u.gesture,
					action: u.action,
					hasEagerState: u.hasEagerState,
					eagerState: u.eagerState,
					next: null
				}, l === null ? (c = l = p, s = o) : l = l.next = p, Y.lanes |= f, Ul |= f;
				u = u.next;
			} while (u !== null && u !== t);
			if (l === null ? s = o : l.next = c, !hr(o, e.memoizedState) && (Zs = !0, d && (n = ia, n !== null))) throw n;
			e.memoizedState = o, e.baseState = s, e.baseQueue = l, r.lastRenderedState = o;
		}
		return a === null && (r.lanes = 0), [e.memoizedState, r.dispatch];
	}
	function Mo(e) {
		var t = wo(), n = t.queue;
		if (n === null) throw Error(i(311));
		n.lastRenderedReducer = e;
		var r = n.dispatch, a = n.pending, o = t.memoizedState;
		if (a !== null) {
			n.pending = null;
			var s = a = a.next;
			do
				o = e(o, s.action), s = s.next;
			while (s !== a);
			hr(o, t.memoizedState) || (Zs = !0), t.memoizedState = o, t.baseQueue === null && (t.baseState = o), n.lastRenderedState = o;
		}
		return [o, r];
	}
	function No(e, t, n) {
		var r = Y, a = wo(), o = J;
		if (o) {
			if (n === void 0) throw Error(i(407));
			n = n();
		} else n = t();
		var s = !hr((io || a).memoizedState, n);
		if (s && (a.memoizedState = n, Zs = !0), a = a.queue, is(Io.bind(null, r, a, e), [e]), a.getSnapshot !== t || s || ao !== null && ao.memoizedState.tag & 1) {
			if (r.flags |= 2048, $o(9, { destroy: void 0 }, Fo.bind(null, r, a, n, t), null), Fl === null) throw Error(i(349));
			o || ro & 127 || Po(r, t, n);
		}
		return n;
	}
	function Po(e, t, n) {
		e.flags |= 16384, e = {
			getSnapshot: t,
			value: n
		}, t = Y.updateQueue, t === null ? (t = To(), Y.updateQueue = t, t.stores = [e]) : (n = t.stores, n === null ? t.stores = [e] : n.push(e));
	}
	function Fo(e, t, n, r) {
		t.value = n, t.getSnapshot = r, Lo(t) && Ro(e);
	}
	function Io(e, t, n) {
		return n(function() {
			Lo(t) && Ro(e);
		});
	}
	function Lo(e) {
		var t = e.getSnapshot;
		e = e.value;
		try {
			var n = t();
			return !hr(e, n);
		} catch {
			return !0;
		}
	}
	function Ro(e) {
		var t = Jr(e, 2);
		t !== null && pu(t, e, 2);
	}
	function zo(e) {
		var t = Co();
		if (typeof e == "function") {
			var n = e;
			if (e = n(), co) {
				Me(!0);
				try {
					n();
				} finally {
					Me(!1);
				}
			}
		}
		return t.memoizedState = t.baseState = e, t.queue = {
			pending: null,
			lanes: 0,
			dispatch: null,
			lastRenderedReducer: ko,
			lastRenderedState: e
		}, t;
	}
	function Bo(e, t, n, r) {
		return e.baseState = n, jo(e, io, typeof r == "function" ? r : ko);
	}
	function Vo(e, t, n, r, a) {
		if (ks(e)) throw Error(i(485));
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
			I.T === null ? o.isTransition = !1 : n(!0), r(o), n = t.pending, n === null ? (o.next = t.pending = o, Ho(t, o)) : (o.next = n.next, t.pending = n.next = o);
		}
	}
	function Ho(e, t) {
		var n = t.action, r = t.payload, i = e.state;
		if (t.isTransition) {
			var a = I.T, o = {};
			I.T = o;
			try {
				var s = n(i, r), c = I.S;
				c !== null && c(o, s), Uo(e, t, s);
			} catch (n) {
				Go(e, t, n);
			} finally {
				a !== null && o.types !== null && (a.types = o.types), I.T = a;
			}
		} else try {
			a = n(i, r), Uo(e, t, a);
		} catch (n) {
			Go(e, t, n);
		}
	}
	function Uo(e, t, n) {
		typeof n == "object" && n && typeof n.then == "function" ? n.then(function(n) {
			Wo(e, t, n);
		}, function(n) {
			return Go(e, t, n);
		}) : Wo(e, t, n);
	}
	function Wo(e, t, n) {
		t.status = "fulfilled", t.value = n, Ko(t), e.state = n, t = e.pending, t !== null && (n = t.next, n === t ? e.pending = null : (n = n.next, t.next = n, Ho(e, n)));
	}
	function Go(e, t, n) {
		var r = e.pending;
		if (e.pending = null, r !== null) {
			r = r.next;
			do
				t.status = "rejected", t.reason = n, Ko(t), t = t.next;
			while (t !== r);
		}
		e.action = null;
	}
	function Ko(e) {
		e = e.listeners;
		for (var t = 0; t < e.length; t++) (0, e[t])();
	}
	function qo(e, t) {
		return t;
	}
	function Jo(e, t) {
		if (J) {
			var n = Fl.formState;
			if (n !== null) {
				a: {
					var r = Y;
					if (J) {
						if (Ti) {
							b: {
								for (var i = Ti, a = Di; i.nodeType !== 8;) {
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
								Ti = cf(i.nextSibling), r = i.data === "F!";
								break a;
							}
						}
						ki(r);
					}
					r = !1;
				}
				r && (t = n[0]);
			}
		}
		return n = Co(), n.memoizedState = n.baseState = t, r = {
			pending: null,
			lanes: 0,
			dispatch: null,
			lastRenderedReducer: qo,
			lastRenderedState: t
		}, n.queue = r, n = Es.bind(null, Y, r), r.dispatch = n, r = zo(!1), a = Os.bind(null, Y, !1, r.queue), r = Co(), i = {
			state: t,
			dispatch: null,
			action: e,
			pending: null
		}, r.queue = i, n = Vo.bind(null, Y, i, a, n), i.dispatch = n, r.memoizedState = e, [
			t,
			n,
			!1
		];
	}
	function Yo(e) {
		return Xo(wo(), io, e);
	}
	function Xo(e, t, n) {
		if (t = jo(e, t, qo)[0], e = Ao(ko)[0], typeof t == "object" && t && typeof t.then == "function") try {
			var r = Eo(t);
		} catch (e) {
			throw e === pa ? ha : e;
		}
		else r = t;
		t = wo();
		var i = t.queue, a = i.dispatch;
		return n !== t.memoizedState && (Y.flags |= 2048, $o(9, { destroy: void 0 }, Zo.bind(null, i, n), null)), [
			r,
			a,
			e
		];
	}
	function Zo(e, t) {
		e.action = t;
	}
	function Qo(e) {
		var t = wo(), n = io;
		if (n !== null) return Xo(t, n, e);
		wo(), t = t.memoizedState, n = wo();
		var r = n.queue.dispatch;
		return n.memoizedState = e, [
			t,
			r,
			!1
		];
	}
	function $o(e, t, n, r) {
		return e = {
			tag: e,
			create: n,
			deps: r,
			inst: t,
			next: null
		}, t = Y.updateQueue, t === null && (t = To(), Y.updateQueue = t), n = t.lastEffect, n === null ? t.lastEffect = e.next = e : (r = n.next, n.next = e, e.next = r, t.lastEffect = e), e;
	}
	function es() {
		return wo().memoizedState;
	}
	function ts(e, t, n, r) {
		var i = Co();
		Y.flags |= e, i.memoizedState = $o(1 | t, { destroy: void 0 }, n, r === void 0 ? null : r);
	}
	function ns(e, t, n, r) {
		var i = wo();
		r = r === void 0 ? null : r;
		var a = i.memoizedState.inst;
		io !== null && r !== null && ho(r, io.memoizedState.deps) ? i.memoizedState = $o(t, a, n, r) : (Y.flags |= e, i.memoizedState = $o(1 | t, a, n, r));
	}
	function rs(e, t) {
		ts(8390656, 8, e, t);
	}
	function is(e, t) {
		ns(2048, 8, e, t);
	}
	function as(e) {
		Y.flags |= 4;
		var t = Y.updateQueue;
		if (t === null) t = To(), Y.updateQueue = t, t.events = [e];
		else {
			var n = t.events;
			n === null ? t.events = [e] : n.push(e);
		}
	}
	function os(e) {
		var t = wo().memoizedState;
		return as({
			ref: t,
			nextImpl: e
		}), function() {
			if (X & 2) throw Error(i(440));
			return t.impl.apply(void 0, arguments);
		};
	}
	function ss(e, t) {
		return ns(4, 2, e, t);
	}
	function cs(e, t) {
		return ns(4, 4, e, t);
	}
	function ls(e, t) {
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
	function us(e, t, n) {
		n = n == null ? null : n.concat([e]), ns(4, 4, ls.bind(null, t, e), n);
	}
	function ds() {}
	function fs(e, t) {
		var n = wo();
		t = t === void 0 ? null : t;
		var r = n.memoizedState;
		return t !== null && ho(t, r[1]) ? r[0] : (n.memoizedState = [e, t], e);
	}
	function ps(e, t) {
		var n = wo();
		t = t === void 0 ? null : t;
		var r = n.memoizedState;
		if (t !== null && ho(t, r[1])) return r[0];
		if (r = e(), co) {
			Me(!0);
			try {
				e();
			} finally {
				Me(!1);
			}
		}
		return n.memoizedState = [r, t], r;
	}
	function ms(e, t, n) {
		return n === void 0 || ro & 1073741824 && !(Q & 261930) ? e.memoizedState = t : (e.memoizedState = n, e = fu(), Y.lanes |= e, Ul |= e, n);
	}
	function hs(e, t, n, r) {
		return hr(n, t) ? n : Ua.current === null ? !(ro & 42) || ro & 1073741824 && !(Q & 261930) ? (Zs = !0, e.memoizedState = n) : (e = fu(), Y.lanes |= e, Ul |= e, t) : (e = ms(e, n, r), hr(e, t) || (Zs = !0), e);
	}
	function gs(e, t, n, r, i) {
		var a = L.p;
		L.p = a !== 0 && 8 > a ? a : 8;
		var o = I.T, s = {};
		I.T = s, Os(e, !1, t, n);
		try {
			var c = i(), l = I.S;
			l !== null && l(s, c), typeof c == "object" && c && typeof c.then == "function" ? Ds(e, t, sa(c, r), du(e)) : Ds(e, t, r, du(e));
		} catch (n) {
			Ds(e, t, {
				then: function() {},
				status: "rejected",
				reason: n
			}, du());
		} finally {
			L.p = a, o !== null && s.types !== null && (o.types = s.types), I.T = o;
		}
	}
	function _s() {}
	function vs(e, t, n, r) {
		if (e.tag !== 5) throw Error(i(476));
		var a = ys(e).queue;
		gs(e, a, t, R, n === null ? _s : function() {
			return bs(e), n(r);
		});
	}
	function ys(e) {
		var t = e.memoizedState;
		if (t !== null) return t;
		t = {
			memoizedState: R,
			baseState: R,
			baseQueue: null,
			queue: {
				pending: null,
				lanes: 0,
				dispatch: null,
				lastRenderedReducer: ko,
				lastRenderedState: R
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
				lastRenderedReducer: ko,
				lastRenderedState: n
			},
			next: null
		}, e.memoizedState = t, e = e.alternate, e !== null && (e.memoizedState = t), t;
	}
	function bs(e) {
		var t = ys(e);
		t.next === null && (t = e.alternate.memoizedState), Ds(e, t.next.queue, {}, du());
	}
	function xs() {
		return Ki(Qf);
	}
	function Ss() {
		return wo().memoizedState;
	}
	function Cs() {
		return wo().memoizedState;
	}
	function ws(e) {
		for (var t = e.return; t !== null;) {
			switch (t.tag) {
				case 24:
				case 3:
					var n = du();
					e = Pa(n);
					var r = Fa(t, e, n);
					r !== null && (pu(r, t, n), Ia(r, t, n)), t = { cache: $i() }, e.payload = t;
					return;
			}
			t = t.return;
		}
	}
	function Ts(e, t, n) {
		var r = du();
		n = {
			lane: r,
			revertLane: 0,
			gesture: null,
			action: n,
			hasEagerState: !1,
			eagerState: null,
			next: null
		}, ks(e) ? As(t, n) : (n = qr(e, t, n, r), n !== null && (pu(n, e, r), js(n, t, r)));
	}
	function Es(e, t, n) {
		Ds(e, t, n, du());
	}
	function Ds(e, t, n, r) {
		var i = {
			lane: r,
			revertLane: 0,
			gesture: null,
			action: n,
			hasEagerState: !1,
			eagerState: null,
			next: null
		};
		if (ks(e)) As(t, i);
		else {
			var a = e.alternate;
			if (e.lanes === 0 && (a === null || a.lanes === 0) && (a = t.lastRenderedReducer, a !== null)) try {
				var o = t.lastRenderedState, s = a(o, n);
				if (i.hasEagerState = !0, i.eagerState = s, hr(s, o)) return Kr(e, t, i, 0), Fl === null && Gr(), !1;
			} catch {}
			if (n = qr(e, t, i, r), n !== null) return pu(n, e, r), js(n, t, r), !0;
		}
		return !1;
	}
	function Os(e, t, n, r) {
		if (r = {
			lane: 2,
			revertLane: ud(),
			gesture: null,
			action: r,
			hasEagerState: !1,
			eagerState: null,
			next: null
		}, ks(e)) {
			if (t) throw Error(i(479));
		} else t = qr(e, n, r, 2), t !== null && pu(t, e, 2);
	}
	function ks(e) {
		var t = e.alternate;
		return e === Y || t !== null && t === Y;
	}
	function As(e, t) {
		so = oo = !0;
		var n = e.pending;
		n === null ? t.next = t : (t.next = n.next, n.next = t), e.pending = t;
	}
	function js(e, t, n) {
		if (n & 4194048) {
			var r = t.lanes;
			r &= e.pendingLanes, n |= r, t.lanes = n, Je(e, n);
		}
	}
	var Ms = {
		readContext: Ki,
		use: Do,
		useCallback: mo,
		useContext: mo,
		useEffect: mo,
		useImperativeHandle: mo,
		useLayoutEffect: mo,
		useInsertionEffect: mo,
		useMemo: mo,
		useReducer: mo,
		useRef: mo,
		useState: mo,
		useDebugValue: mo,
		useDeferredValue: mo,
		useTransition: mo,
		useSyncExternalStore: mo,
		useId: mo,
		useHostTransitionStatus: mo,
		useFormState: mo,
		useActionState: mo,
		useOptimistic: mo,
		useMemoCache: mo,
		useCacheRefresh: mo
	};
	Ms.useEffectEvent = mo;
	var Ns = {
		readContext: Ki,
		use: Do,
		useCallback: function(e, t) {
			return Co().memoizedState = [e, t === void 0 ? null : t], e;
		},
		useContext: Ki,
		useEffect: rs,
		useImperativeHandle: function(e, t, n) {
			n = n == null ? null : n.concat([e]), ts(4194308, 4, ls.bind(null, t, e), n);
		},
		useLayoutEffect: function(e, t) {
			return ts(4194308, 4, e, t);
		},
		useInsertionEffect: function(e, t) {
			ts(4, 2, e, t);
		},
		useMemo: function(e, t) {
			var n = Co();
			t = t === void 0 ? null : t;
			var r = e();
			if (co) {
				Me(!0);
				try {
					e();
				} finally {
					Me(!1);
				}
			}
			return n.memoizedState = [r, t], r;
		},
		useReducer: function(e, t, n) {
			var r = Co();
			if (n !== void 0) {
				var i = n(t);
				if (co) {
					Me(!0);
					try {
						n(t);
					} finally {
						Me(!1);
					}
				}
			} else i = t;
			return r.memoizedState = r.baseState = i, e = {
				pending: null,
				lanes: 0,
				dispatch: null,
				lastRenderedReducer: e,
				lastRenderedState: i
			}, r.queue = e, e = e.dispatch = Ts.bind(null, Y, e), [r.memoizedState, e];
		},
		useRef: function(e) {
			var t = Co();
			return e = { current: e }, t.memoizedState = e;
		},
		useState: function(e) {
			e = zo(e);
			var t = e.queue, n = Es.bind(null, Y, t);
			return t.dispatch = n, [e.memoizedState, n];
		},
		useDebugValue: ds,
		useDeferredValue: function(e, t) {
			return ms(Co(), e, t);
		},
		useTransition: function() {
			var e = zo(!1);
			return e = gs.bind(null, Y, e.queue, !0, !1), Co().memoizedState = e, [!1, e];
		},
		useSyncExternalStore: function(e, t, n) {
			var r = Y, a = Co();
			if (J) {
				if (n === void 0) throw Error(i(407));
				n = n();
			} else {
				if (n = t(), Fl === null) throw Error(i(349));
				Q & 127 || Po(r, t, n);
			}
			a.memoizedState = n;
			var o = {
				value: n,
				getSnapshot: t
			};
			return a.queue = o, rs(Io.bind(null, r, o, e), [e]), r.flags |= 2048, $o(9, { destroy: void 0 }, Fo.bind(null, r, o, n, t), null), n;
		},
		useId: function() {
			var e = Co(), t = Fl.identifierPrefix;
			if (J) {
				var n = vi, r = _i;
				n = (r & ~(1 << 32 - U(r) - 1)).toString(32) + n, t = "_" + t + "R_" + n, n = lo++, 0 < n && (t += "H" + n.toString(32)), t += "_";
			} else n = po++, t = "_" + t + "r_" + n.toString(32) + "_";
			return e.memoizedState = t;
		},
		useHostTransitionStatus: xs,
		useFormState: Jo,
		useActionState: Jo,
		useOptimistic: function(e) {
			var t = Co();
			t.memoizedState = t.baseState = e;
			var n = {
				pending: null,
				lanes: 0,
				dispatch: null,
				lastRenderedReducer: null,
				lastRenderedState: null
			};
			return t.queue = n, t = Os.bind(null, Y, !0, n), n.dispatch = t, [e, t];
		},
		useMemoCache: Oo,
		useCacheRefresh: function() {
			return Co().memoizedState = ws.bind(null, Y);
		},
		useEffectEvent: function(e) {
			var t = Co(), n = { impl: e };
			return t.memoizedState = n, function() {
				if (X & 2) throw Error(i(440));
				return n.impl.apply(void 0, arguments);
			};
		}
	}, Ps = {
		readContext: Ki,
		use: Do,
		useCallback: fs,
		useContext: Ki,
		useEffect: is,
		useImperativeHandle: us,
		useInsertionEffect: ss,
		useLayoutEffect: cs,
		useMemo: ps,
		useReducer: Ao,
		useRef: es,
		useState: function() {
			return Ao(ko);
		},
		useDebugValue: ds,
		useDeferredValue: function(e, t) {
			return hs(wo(), io.memoizedState, e, t);
		},
		useTransition: function() {
			var e = Ao(ko)[0], t = wo().memoizedState;
			return [typeof e == "boolean" ? e : Eo(e), t];
		},
		useSyncExternalStore: No,
		useId: Ss,
		useHostTransitionStatus: xs,
		useFormState: Yo,
		useActionState: Yo,
		useOptimistic: function(e, t) {
			return Bo(wo(), io, e, t);
		},
		useMemoCache: Oo,
		useCacheRefresh: Cs
	};
	Ps.useEffectEvent = os;
	var Fs = {
		readContext: Ki,
		use: Do,
		useCallback: fs,
		useContext: Ki,
		useEffect: is,
		useImperativeHandle: us,
		useInsertionEffect: ss,
		useLayoutEffect: cs,
		useMemo: ps,
		useReducer: Mo,
		useRef: es,
		useState: function() {
			return Mo(ko);
		},
		useDebugValue: ds,
		useDeferredValue: function(e, t) {
			var n = wo();
			return io === null ? ms(n, e, t) : hs(n, io.memoizedState, e, t);
		},
		useTransition: function() {
			var e = Mo(ko)[0], t = wo().memoizedState;
			return [typeof e == "boolean" ? e : Eo(e), t];
		},
		useSyncExternalStore: No,
		useId: Ss,
		useHostTransitionStatus: xs,
		useFormState: Qo,
		useActionState: Qo,
		useOptimistic: function(e, t) {
			var n = wo();
			return io === null ? (n.baseState = e, [e, n.queue.dispatch]) : Bo(n, io, e, t);
		},
		useMemoCache: Oo,
		useCacheRefresh: Cs
	};
	Fs.useEffectEvent = os;
	function Is(e, t, n, r) {
		t = e.memoizedState, n = n(r, t), n = n == null ? t : h({}, t, n), e.memoizedState = n, e.lanes === 0 && (e.updateQueue.baseState = n);
	}
	var Ls = {
		enqueueSetState: function(e, t, n) {
			e = e._reactInternals;
			var r = du(), i = Pa(r);
			i.payload = t, n != null && (i.callback = n), t = Fa(e, i, r), t !== null && (pu(t, e, r), Ia(t, e, r));
		},
		enqueueReplaceState: function(e, t, n) {
			e = e._reactInternals;
			var r = du(), i = Pa(r);
			i.tag = 1, i.payload = t, n != null && (i.callback = n), t = Fa(e, i, r), t !== null && (pu(t, e, r), Ia(t, e, r));
		},
		enqueueForceUpdate: function(e, t) {
			e = e._reactInternals;
			var n = du(), r = Pa(n);
			r.tag = 2, t != null && (r.callback = t), t = Fa(e, r, n), t !== null && (pu(t, e, n), Ia(t, e, n));
		}
	};
	function Rs(e, t, n, r, i, a, o) {
		return e = e.stateNode, typeof e.shouldComponentUpdate == "function" ? e.shouldComponentUpdate(r, a, o) : t.prototype && t.prototype.isPureReactComponent ? !gr(n, r) || !gr(i, a) : !0;
	}
	function zs(e, t, n, r) {
		e = t.state, typeof t.componentWillReceiveProps == "function" && t.componentWillReceiveProps(n, r), typeof t.UNSAFE_componentWillReceiveProps == "function" && t.UNSAFE_componentWillReceiveProps(n, r), t.state !== e && Ls.enqueueReplaceState(t, t.state, null);
	}
	function Bs(e, t) {
		var n = t;
		if ("ref" in t) for (var r in n = {}, t) r !== "ref" && (n[r] = t[r]);
		if (e = e.defaultProps) for (var i in n === t && (n = h({}, n)), e) n[i] === void 0 && (n[i] = e[i]);
		return n;
	}
	function Vs(e) {
		Vr(e);
	}
	function Hs(e) {
		console.error(e);
	}
	function Us(e) {
		Vr(e);
	}
	function Ws(e, t) {
		try {
			var n = e.onUncaughtError;
			n(t.value, { componentStack: t.stack });
		} catch (e) {
			setTimeout(function() {
				throw e;
			});
		}
	}
	function Gs(e, t, n) {
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
	function Ks(e, t, n) {
		return n = Pa(n), n.tag = 3, n.payload = { element: null }, n.callback = function() {
			Ws(e, t);
		}, n;
	}
	function qs(e) {
		return e = Pa(e), e.tag = 3, e;
	}
	function Js(e, t, n, r) {
		var i = n.type.getDerivedStateFromError;
		if (typeof i == "function") {
			var a = r.value;
			e.payload = function() {
				return i(a);
			}, e.callback = function() {
				Gs(t, n, r);
			};
		}
		var o = n.stateNode;
		o !== null && typeof o.componentDidCatch == "function" && (e.callback = function() {
			Gs(t, n, r), typeof i != "function" && (tu === null ? tu = /* @__PURE__ */ new Set([this]) : tu.add(this));
			var e = r.stack;
			this.componentDidCatch(r.value, { componentStack: e === null ? "" : e });
		});
	}
	function Ys(e, t, n, r, a) {
		if (n.flags |= 32768, typeof r == "object" && r && typeof r.then == "function") {
			if (t = n.alternate, t !== null && Ui(t, n, a, !0), n = Ja.current, n !== null) {
				switch (n.tag) {
					case 31:
					case 13: return Ya === null ? Tu() : n.alternate === null && Hl === 0 && (Hl = 3), n.flags &= -257, n.flags |= 65536, n.lanes = a, r === ga ? n.flags |= 16384 : (t = n.updateQueue, t === null ? n.updateQueue = /* @__PURE__ */ new Set([r]) : t.add(r), Wu(e, r, a)), !1;
					case 22: return n.flags |= 65536, r === ga ? n.flags |= 16384 : (t = n.updateQueue, t === null ? (t = {
						transitions: null,
						markerInstances: null,
						retryQueue: /* @__PURE__ */ new Set([r])
					}, n.updateQueue = t) : (n = t.retryQueue, n === null ? t.retryQueue = /* @__PURE__ */ new Set([r]) : n.add(r)), Wu(e, r, a)), !1;
				}
				throw Error(i(435, n.tag));
			}
			return Wu(e, r, a), Tu(), !1;
		}
		if (J) return t = Ja.current, t === null ? (r !== Oi && (t = Error(i(423), { cause: r }), Fi(li(t, n))), e = e.current.alternate, e.flags |= 65536, a &= -a, e.lanes |= a, r = li(r, n), a = Ks(e.stateNode, r, a), La(e, a), Hl !== 4 && (Hl = 2)) : (!(t.flags & 65536) && (t.flags |= 256), t.flags |= 65536, t.lanes = a, r !== Oi && (e = Error(i(422), { cause: r }), Fi(li(e, n)))), !1;
		var o = Error(i(520), { cause: r });
		if (o = li(o, n), Jl === null ? Jl = [o] : Jl.push(o), Hl !== 4 && (Hl = 2), t === null) return !0;
		r = li(r, n), n = t;
		do {
			switch (n.tag) {
				case 3: return n.flags |= 65536, e = a & -a, n.lanes |= e, e = Ks(n.stateNode, r, e), La(n, e), !1;
				case 1: if (t = n.type, o = n.stateNode, !(n.flags & 128) && (typeof t.getDerivedStateFromError == "function" || o !== null && typeof o.componentDidCatch == "function" && (tu === null || !tu.has(o)))) return n.flags |= 65536, a &= -a, n.lanes |= a, a = qs(a), Js(a, e, n, r), La(n, a), !1;
			}
			n = n.return;
		} while (n !== null);
		return !1;
	}
	var Xs = Error(i(461)), Zs = !1;
	function Qs(e, t, n, r) {
		t.child = e === null ? Aa(t, null, n, r) : ka(t, e.child, n, r);
	}
	function $s(e, t, n, r, i) {
		n = n.render;
		var a = t.ref;
		if ("ref" in r) {
			var o = {};
			for (var s in r) s !== "ref" && (o[s] = r[s]);
		} else o = r;
		return Gi(t), r = go(e, t, n, o, a, i), s = bo(), e !== null && !Zs ? (xo(e, t, i), Cc(e, t, i)) : (J && s && xi(t), t.flags |= 1, Qs(e, t, r, i), t.child);
	}
	function ec(e, t, n, r, i) {
		if (e === null) {
			var a = n.type;
			return typeof a == "function" && !ei(a) && a.defaultProps === void 0 && n.compare === null ? (t.tag = 15, t.type = a, tc(e, t, a, r, i)) : (e = ri(n.type, null, r, t, t.mode, i), e.ref = t.ref, e.return = t, t.child = e);
		}
		if (a = e.child, !wc(e, i)) {
			var o = a.memoizedProps;
			if (n = n.compare, n = n === null ? gr : n, n(o, r) && e.ref === t.ref) return Cc(e, t, i);
		}
		return t.flags |= 1, e = ti(a, r), e.ref = t.ref, e.return = t, t.child = e;
	}
	function tc(e, t, n, r, i) {
		if (e !== null) {
			var a = e.memoizedProps;
			if (gr(a, r) && e.ref === t.ref) if (Zs = !1, t.pendingProps = r = a, wc(e, i)) e.flags & 131072 && (Zs = !0);
			else return t.lanes = e.lanes, Cc(e, t, i);
		}
		return lc(e, t, n, r, i);
	}
	function nc(e, t, n, r) {
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
				return ic(e, t, a, n, r);
			}
			if (n & 536870912) t.memoizedState = {
				baseLanes: 0,
				cachePool: null
			}, e !== null && da(t, a === null ? null : a.cachePool), a === null ? Ka() : Ga(t, a), Qa(t);
			else return r = t.lanes = 536870912, ic(e, t, a === null ? n : a.baseLanes | n, n, r);
		} else a === null ? (e !== null && da(t, null), Ka(), $a(t)) : (da(t, a.cachePool), Ga(t, a), $a(t), t.memoizedState = null);
		return Qs(e, t, i, n), t.child;
	}
	function rc(e, t) {
		return e !== null && e.tag === 22 || t.stateNode !== null || (t.stateNode = {
			_visibility: 1,
			_pendingMarkers: null,
			_retryCache: null,
			_transitions: null
		}), t.sibling;
	}
	function ic(e, t, n, r, i) {
		var a = ua();
		return a = a === null ? null : {
			parent: Qi._currentValue,
			pool: a
		}, t.memoizedState = {
			baseLanes: n,
			cachePool: a
		}, e !== null && da(t, null), Ka(), Qa(t), e !== null && Ui(e, t, r, !0), t.childLanes = i, null;
	}
	function ac(e, t) {
		return t = vc({
			mode: t.mode,
			children: t.children
		}, e.mode), t.ref = e.ref, e.child = t, t.return = e, t;
	}
	function oc(e, t, n) {
		return ka(t, e.child, null, n), e = ac(t, t.pendingProps), e.flags |= 2, eo(t), t.memoizedState = null, e;
	}
	function sc(e, t, n) {
		var r = t.pendingProps, a = (t.flags & 128) != 0;
		if (t.flags &= -129, e === null) {
			if (J) {
				if (r.mode === "hidden") return e = ac(t, r), t.lanes = 536870912, rc(null, e);
				if (Za(t), (e = Ti) ? (e = rf(e, Di), e = e !== null && e.data === "&" ? e : null, e !== null && (t.memoizedState = {
					dehydrated: e,
					treeContext: gi === null ? null : {
						id: _i,
						overflow: vi
					},
					retryLane: 536870912,
					hydrationErrors: null
				}, n = oi(e), n.return = t, t.child = n, wi = t, Ti = null)) : e = null, e === null) throw ki(t);
				return t.lanes = 536870912, null;
			}
			return ac(t, r);
		}
		var o = e.memoizedState;
		if (o !== null) {
			var s = o.dehydrated;
			if (Za(t), a) if (t.flags & 256) t.flags &= -257, t = oc(e, t, n);
			else if (t.memoizedState !== null) t.child = e.child, t.flags |= 128, t = null;
			else throw Error(i(558));
			else if (Zs || Ui(e, t, n, !1), a = (n & e.childLanes) !== 0, Zs || a) {
				if (r = Fl, r !== null && (s = Ye(r, n), s !== 0 && s !== o.retryLane)) throw o.retryLane = s, Jr(e, s), pu(r, e, s), Xs;
				Tu(), t = oc(e, t, n);
			} else e = o.treeContext, Ti = cf(s.nextSibling), wi = t, J = !0, Ei = null, Di = !1, e !== null && Ci(t, e), t = ac(t, r), t.flags |= 4096;
			return t;
		}
		return e = ti(e.child, {
			mode: r.mode,
			children: r.children
		}), e.ref = t.ref, t.child = e, e.return = t, e;
	}
	function cc(e, t) {
		var n = t.ref;
		if (n === null) e !== null && e.ref !== null && (t.flags |= 4194816);
		else {
			if (typeof n != "function" && typeof n != "object") throw Error(i(284));
			(e === null || e.ref !== n) && (t.flags |= 4194816);
		}
	}
	function lc(e, t, n, r, i) {
		return Gi(t), n = go(e, t, n, r, void 0, i), r = bo(), e !== null && !Zs ? (xo(e, t, i), Cc(e, t, i)) : (J && r && xi(t), t.flags |= 1, Qs(e, t, n, i), t.child);
	}
	function uc(e, t, n, r, i, a) {
		return Gi(t), t.updateQueue = null, n = vo(t, r, n, i), _o(e), r = bo(), e !== null && !Zs ? (xo(e, t, a), Cc(e, t, a)) : (J && r && xi(t), t.flags |= 1, Qs(e, t, n, a), t.child);
	}
	function dc(e, t, n, r, i) {
		if (Gi(t), t.stateNode === null) {
			var a = Zr, o = n.contextType;
			typeof o == "object" && o && (a = Ki(o)), a = new n(r, a), t.memoizedState = a.state !== null && a.state !== void 0 ? a.state : null, a.updater = Ls, t.stateNode = a, a._reactInternals = t, a = t.stateNode, a.props = r, a.state = t.memoizedState, a.refs = {}, Ma(t), o = n.contextType, a.context = typeof o == "object" && o ? Ki(o) : Zr, a.state = t.memoizedState, o = n.getDerivedStateFromProps, typeof o == "function" && (Is(t, n, o, r), a.state = t.memoizedState), typeof n.getDerivedStateFromProps == "function" || typeof a.getSnapshotBeforeUpdate == "function" || typeof a.UNSAFE_componentWillMount != "function" && typeof a.componentWillMount != "function" || (o = a.state, typeof a.componentWillMount == "function" && a.componentWillMount(), typeof a.UNSAFE_componentWillMount == "function" && a.UNSAFE_componentWillMount(), o !== a.state && Ls.enqueueReplaceState(a, a.state, null), Ba(t, r, a, i), za(), a.state = t.memoizedState), typeof a.componentDidMount == "function" && (t.flags |= 4194308), r = !0;
		} else if (e === null) {
			a = t.stateNode;
			var s = t.memoizedProps, c = Bs(n, s);
			a.props = c;
			var l = a.context, u = n.contextType;
			o = Zr, typeof u == "object" && u && (o = Ki(u));
			var d = n.getDerivedStateFromProps;
			u = typeof d == "function" || typeof a.getSnapshotBeforeUpdate == "function", s = t.pendingProps !== s, u || typeof a.UNSAFE_componentWillReceiveProps != "function" && typeof a.componentWillReceiveProps != "function" || (s || l !== o) && zs(t, a, r, o), ja = !1;
			var f = t.memoizedState;
			a.state = f, Ba(t, r, a, i), za(), l = t.memoizedState, s || f !== l || ja ? (typeof d == "function" && (Is(t, n, d, r), l = t.memoizedState), (c = ja || Rs(t, n, c, r, f, l, o)) ? (u || typeof a.UNSAFE_componentWillMount != "function" && typeof a.componentWillMount != "function" || (typeof a.componentWillMount == "function" && a.componentWillMount(), typeof a.UNSAFE_componentWillMount == "function" && a.UNSAFE_componentWillMount()), typeof a.componentDidMount == "function" && (t.flags |= 4194308)) : (typeof a.componentDidMount == "function" && (t.flags |= 4194308), t.memoizedProps = r, t.memoizedState = l), a.props = r, a.state = l, a.context = o, r = c) : (typeof a.componentDidMount == "function" && (t.flags |= 4194308), r = !1);
		} else {
			a = t.stateNode, Na(e, t), o = t.memoizedProps, u = Bs(n, o), a.props = u, d = t.pendingProps, f = a.context, l = n.contextType, c = Zr, typeof l == "object" && l && (c = Ki(l)), s = n.getDerivedStateFromProps, (l = typeof s == "function" || typeof a.getSnapshotBeforeUpdate == "function") || typeof a.UNSAFE_componentWillReceiveProps != "function" && typeof a.componentWillReceiveProps != "function" || (o !== d || f !== c) && zs(t, a, r, c), ja = !1, f = t.memoizedState, a.state = f, Ba(t, r, a, i), za();
			var p = t.memoizedState;
			o !== d || f !== p || ja || e !== null && e.dependencies !== null && Wi(e.dependencies) ? (typeof s == "function" && (Is(t, n, s, r), p = t.memoizedState), (u = ja || Rs(t, n, u, r, f, p, c) || e !== null && e.dependencies !== null && Wi(e.dependencies)) ? (l || typeof a.UNSAFE_componentWillUpdate != "function" && typeof a.componentWillUpdate != "function" || (typeof a.componentWillUpdate == "function" && a.componentWillUpdate(r, p, c), typeof a.UNSAFE_componentWillUpdate == "function" && a.UNSAFE_componentWillUpdate(r, p, c)), typeof a.componentDidUpdate == "function" && (t.flags |= 4), typeof a.getSnapshotBeforeUpdate == "function" && (t.flags |= 1024)) : (typeof a.componentDidUpdate != "function" || o === e.memoizedProps && f === e.memoizedState || (t.flags |= 4), typeof a.getSnapshotBeforeUpdate != "function" || o === e.memoizedProps && f === e.memoizedState || (t.flags |= 1024), t.memoizedProps = r, t.memoizedState = p), a.props = r, a.state = p, a.context = c, r = u) : (typeof a.componentDidUpdate != "function" || o === e.memoizedProps && f === e.memoizedState || (t.flags |= 4), typeof a.getSnapshotBeforeUpdate != "function" || o === e.memoizedProps && f === e.memoizedState || (t.flags |= 1024), r = !1);
		}
		return a = r, cc(e, t), r = (t.flags & 128) != 0, a || r ? (a = t.stateNode, n = r && typeof n.getDerivedStateFromError != "function" ? null : a.render(), t.flags |= 1, e !== null && r ? (t.child = ka(t, e.child, null, i), t.child = ka(t, null, n, i)) : Qs(e, t, n, i), t.memoizedState = a.state, e = t.child) : e = Cc(e, t, i), e;
	}
	function fc(e, t, n, r) {
		return Ni(), t.flags |= 256, Qs(e, t, n, r), t.child;
	}
	var pc = {
		dehydrated: null,
		treeContext: null,
		retryLane: 0,
		hydrationErrors: null
	};
	function mc(e) {
		return {
			baseLanes: e,
			cachePool: fa()
		};
	}
	function hc(e, t, n) {
		return e = e === null ? 0 : e.childLanes & ~n, t && (e |= Kl), e;
	}
	function gc(e, t, n) {
		var r = t.pendingProps, a = !1, o = (t.flags & 128) != 0, s;
		if ((s = o) || (s = e !== null && e.memoizedState === null ? !1 : (to.current & 2) != 0), s && (a = !0, t.flags &= -129), s = (t.flags & 32) != 0, t.flags &= -33, e === null) {
			if (J) {
				if (a ? Xa(t) : $a(t), (e = Ti) ? (e = rf(e, Di), e = e !== null && e.data !== "&" ? e : null, e !== null && (t.memoizedState = {
					dehydrated: e,
					treeContext: gi === null ? null : {
						id: _i,
						overflow: vi
					},
					retryLane: 536870912,
					hydrationErrors: null
				}, n = oi(e), n.return = t, t.child = n, wi = t, Ti = null)) : e = null, e === null) throw ki(t);
				return of(e) ? t.lanes = 32 : t.lanes = 536870912, null;
			}
			var c = r.children;
			return r = r.fallback, a ? ($a(t), a = t.mode, c = vc({
				mode: "hidden",
				children: c
			}, a), r = ii(r, a, n, null), c.return = t, r.return = t, c.sibling = r, t.child = c, r = t.child, r.memoizedState = mc(n), r.childLanes = hc(e, s, n), t.memoizedState = pc, rc(null, r)) : (Xa(t), _c(t, c));
		}
		var l = e.memoizedState;
		if (l !== null && (c = l.dehydrated, c !== null)) {
			if (o) t.flags & 256 ? (Xa(t), t.flags &= -257, t = yc(e, t, n)) : t.memoizedState === null ? ($a(t), c = r.fallback, a = t.mode, r = vc({
				mode: "visible",
				children: r.children
			}, a), c = ii(c, a, n, null), c.flags |= 2, r.return = t, c.return = t, r.sibling = c, t.child = r, ka(t, e.child, null, n), r = t.child, r.memoizedState = mc(n), r.childLanes = hc(e, s, n), t.memoizedState = pc, t = rc(null, r)) : ($a(t), t.child = e.child, t.flags |= 128, t = null);
			else if (Xa(t), of(c)) {
				if (s = c.nextSibling && c.nextSibling.dataset, s) var u = s.dgst;
				s = u, r = Error(i(419)), r.stack = "", r.digest = s, Fi({
					value: r,
					source: null,
					stack: null
				}), t = yc(e, t, n);
			} else if (Zs || Ui(e, t, n, !1), s = (n & e.childLanes) !== 0, Zs || s) {
				if (s = Fl, s !== null && (r = Ye(s, n), r !== 0 && r !== l.retryLane)) throw l.retryLane = r, Jr(e, r), pu(s, e, r), Xs;
				af(c) || Tu(), t = yc(e, t, n);
			} else af(c) ? (t.flags |= 192, t.child = e.child, t = null) : (e = l.treeContext, Ti = cf(c.nextSibling), wi = t, J = !0, Ei = null, Di = !1, e !== null && Ci(t, e), t = _c(t, r.children), t.flags |= 4096);
			return t;
		}
		return a ? ($a(t), c = r.fallback, a = t.mode, l = e.child, u = l.sibling, r = ti(l, {
			mode: "hidden",
			children: r.children
		}), r.subtreeFlags = l.subtreeFlags & 65011712, u === null ? (c = ii(c, a, n, null), c.flags |= 2) : c = ti(u, c), c.return = t, r.return = t, r.sibling = c, t.child = r, rc(null, r), r = t.child, c = e.child.memoizedState, c === null ? c = mc(n) : (a = c.cachePool, a === null ? a = fa() : (l = Qi._currentValue, a = a.parent === l ? a : {
			parent: l,
			pool: l
		}), c = {
			baseLanes: c.baseLanes | n,
			cachePool: a
		}), r.memoizedState = c, r.childLanes = hc(e, s, n), t.memoizedState = pc, rc(e.child, r)) : (Xa(t), n = e.child, e = n.sibling, n = ti(n, {
			mode: "visible",
			children: r.children
		}), n.return = t, n.sibling = null, e !== null && (s = t.deletions, s === null ? (t.deletions = [e], t.flags |= 16) : s.push(e)), t.child = n, t.memoizedState = null, n);
	}
	function _c(e, t) {
		return t = vc({
			mode: "visible",
			children: t
		}, e.mode), t.return = e, e.child = t;
	}
	function vc(e, t) {
		return e = $r(22, e, null, t), e.lanes = 0, e;
	}
	function yc(e, t, n) {
		return ka(t, e.child, null, n), e = _c(t, t.pendingProps.children), e.flags |= 2, t.memoizedState = null, e;
	}
	function bc(e, t, n) {
		e.lanes |= t;
		var r = e.alternate;
		r !== null && (r.lanes |= t), Vi(e.return, t, n);
	}
	function xc(e, t, n, r, i, a) {
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
	function Sc(e, t, n) {
		var r = t.pendingProps, i = r.revealOrder, a = r.tail;
		r = r.children;
		var o = to.current, s = (o & 2) != 0;
		if (s ? (o = o & 1 | 2, t.flags |= 128) : o &= 1, V(to, o), Qs(e, t, r, n), r = J ? pi : 0, !s && e !== null && e.flags & 128) a: for (e = t.child; e !== null;) {
			if (e.tag === 13) e.memoizedState !== null && bc(e, n, t);
			else if (e.tag === 19) bc(e, n, t);
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
				for (n = t.child, i = null; n !== null;) e = n.alternate, e !== null && no(e) === null && (i = n), n = n.sibling;
				n = i, n === null ? (i = t.child, t.child = null) : (i = n.sibling, n.sibling = null), xc(t, !1, i, n, a, r);
				break;
			case "backwards":
			case "unstable_legacy-backwards":
				for (n = null, i = t.child, t.child = null; i !== null;) {
					if (e = i.alternate, e !== null && no(e) === null) {
						t.child = i;
						break;
					}
					e = i.sibling, i.sibling = n, n = i, i = e;
				}
				xc(t, !0, n, null, a, r);
				break;
			case "together":
				xc(t, !1, null, null, void 0, r);
				break;
			default: t.memoizedState = null;
		}
		return t.child;
	}
	function Cc(e, t, n) {
		if (e !== null && (t.dependencies = e.dependencies), Ul |= t.lanes, (n & t.childLanes) === 0) if (e !== null) {
			if (Ui(e, t, n, !1), (n & t.childLanes) === 0) return null;
		} else return null;
		if (e !== null && t.child !== e.child) throw Error(i(153));
		if (t.child !== null) {
			for (e = t.child, n = ti(e, e.pendingProps), t.child = n, n.return = t; e.sibling !== null;) e = e.sibling, n = n.sibling = ti(e, e.pendingProps), n.return = t;
			n.sibling = null;
		}
		return t.child;
	}
	function wc(e, t) {
		return (e.lanes & t) === 0 ? (e = e.dependencies, !!(e !== null && Wi(e))) : !0;
	}
	function Tc(e, t, n) {
		switch (t.tag) {
			case 3:
				oe(t, t.stateNode.containerInfo), zi(t, Qi, e.memoizedState.cache), Ni();
				break;
			case 27:
			case 5:
				ce(t);
				break;
			case 4:
				oe(t, t.stateNode.containerInfo);
				break;
			case 10:
				zi(t, t.type, t.memoizedProps.value);
				break;
			case 31:
				if (t.memoizedState !== null) return t.flags |= 128, Za(t), null;
				break;
			case 13:
				var r = t.memoizedState;
				if (r !== null) return r.dehydrated === null ? (n & t.child.childLanes) === 0 ? (Xa(t), e = Cc(e, t, n), e === null ? null : e.sibling) : gc(e, t, n) : (Xa(t), t.flags |= 128, null);
				Xa(t);
				break;
			case 19:
				var i = (e.flags & 128) != 0;
				if (r = (n & t.childLanes) !== 0, r ||= (Ui(e, t, n, !1), (n & t.childLanes) !== 0), i) {
					if (r) return Sc(e, t, n);
					t.flags |= 128;
				}
				if (i = t.memoizedState, i !== null && (i.rendering = null, i.tail = null, i.lastEffect = null), V(to, to.current), r) break;
				return null;
			case 22: return t.lanes = 0, nc(e, t, n, t.pendingProps);
			case 24: zi(t, Qi, e.memoizedState.cache);
		}
		return Cc(e, t, n);
	}
	function Ec(e, t, n) {
		if (e !== null) if (e.memoizedProps !== t.pendingProps) Zs = !0;
		else {
			if (!wc(e, n) && !(t.flags & 128)) return Zs = !1, Tc(e, t, n);
			Zs = !!(e.flags & 131072);
		}
		else Zs = !1, J && t.flags & 1048576 && bi(t, pi, t.index);
		switch (t.lanes = 0, t.tag) {
			case 16:
				a: {
					var r = t.pendingProps;
					if (e = ya(t.elementType), t.type = e, typeof e == "function") ei(e) ? (r = Bs(e, r), t.tag = 1, t = dc(null, t, e, r, n)) : (t.tag = 0, t = lc(null, t, e, r, n));
					else {
						if (e != null) {
							var a = e.$$typeof;
							if (a === w) {
								t.tag = 11, t = $s(null, t, e, r, n);
								break a;
							} else if (a === D) {
								t.tag = 14, t = ec(null, t, e, r, n);
								break a;
							}
						}
						throw t = P(e) || e, Error(i(306, t, ""));
					}
				}
				return t;
			case 0: return lc(e, t, t.type, t.pendingProps, n);
			case 1: return r = t.type, a = Bs(r, t.pendingProps), dc(e, t, r, a, n);
			case 3:
				a: {
					if (oe(t, t.stateNode.containerInfo), e === null) throw Error(i(387));
					r = t.pendingProps;
					var o = t.memoizedState;
					a = o.element, Na(e, t), Ba(t, r, null, n);
					var s = t.memoizedState;
					if (r = s.cache, zi(t, Qi, r), r !== o.cache && Hi(t, [Qi], n, !0), za(), r = s.element, o.isDehydrated) if (o = {
						element: r,
						isDehydrated: !1,
						cache: s.cache
					}, t.updateQueue.baseState = o, t.memoizedState = o, t.flags & 256) {
						t = fc(e, t, r, n);
						break a;
					} else if (r !== a) {
						a = li(Error(i(424)), t), Fi(a), t = fc(e, t, r, n);
						break a;
					} else {
						switch (e = t.stateNode.containerInfo, e.nodeType) {
							case 9:
								e = e.body;
								break;
							default: e = e.nodeName === "HTML" ? e.ownerDocument.body : e;
						}
						for (Ti = cf(e.firstChild), wi = t, J = !0, Ei = null, Di = !0, n = Aa(t, null, r, n), t.child = n; n;) n.flags = n.flags & -3 | 4096, n = n.sibling;
					}
					else {
						if (Ni(), r === a) {
							t = Cc(e, t, n);
							break a;
						}
						Qs(e, t, r, n);
					}
					t = t.child;
				}
				return t;
			case 26: return cc(e, t), e === null ? (n = kf(t.type, null, t.pendingProps, null)) ? t.memoizedState = n : J || (n = t.type, e = t.pendingProps, r = Bd(ie.current).createElement(n), r[tt] = t, r[nt] = e, Pd(r, n, e), ft(r), t.stateNode = r) : t.memoizedState = kf(t.type, e.memoizedProps, t.pendingProps, e.memoizedState), null;
			case 27: return ce(t), e === null && J && (r = t.stateNode = ff(t.type, t.pendingProps, ie.current), wi = t, Di = !0, a = Ti, Zd(t.type) ? (lf = a, Ti = cf(r.firstChild)) : Ti = a), Qs(e, t, t.pendingProps.children, n), cc(e, t), e === null && (t.flags |= 4194304), t.child;
			case 5: return e === null && J && ((a = r = Ti) && (r = tf(r, t.type, t.pendingProps, Di), r === null ? a = !1 : (t.stateNode = r, wi = t, Ti = cf(r.firstChild), Di = !1, a = !0)), a || ki(t)), ce(t), a = t.type, o = t.pendingProps, s = e === null ? null : e.memoizedProps, r = o.children, Ud(a, o) ? r = null : s !== null && Ud(a, s) && (t.flags |= 32), t.memoizedState !== null && (a = go(e, t, yo, null, null, n), Qf._currentValue = a), cc(e, t), Qs(e, t, r, n), t.child;
			case 6: return e === null && J && ((e = n = Ti) && (n = nf(n, t.pendingProps, Di), n === null ? e = !1 : (t.stateNode = n, wi = t, Ti = null, e = !0)), e || ki(t)), null;
			case 13: return gc(e, t, n);
			case 4: return oe(t, t.stateNode.containerInfo), r = t.pendingProps, e === null ? t.child = ka(t, null, r, n) : Qs(e, t, r, n), t.child;
			case 11: return $s(e, t, t.type, t.pendingProps, n);
			case 7: return Qs(e, t, t.pendingProps, n), t.child;
			case 8: return Qs(e, t, t.pendingProps.children, n), t.child;
			case 12: return Qs(e, t, t.pendingProps.children, n), t.child;
			case 10: return r = t.pendingProps, zi(t, t.type, r.value), Qs(e, t, r.children, n), t.child;
			case 9: return a = t.type._context, r = t.pendingProps.children, Gi(t), a = Ki(a), r = r(a), t.flags |= 1, Qs(e, t, r, n), t.child;
			case 14: return ec(e, t, t.type, t.pendingProps, n);
			case 15: return tc(e, t, t.type, t.pendingProps, n);
			case 19: return Sc(e, t, n);
			case 31: return sc(e, t, n);
			case 22: return nc(e, t, n, t.pendingProps);
			case 24: return Gi(t), r = Ki(Qi), e === null ? (a = ua(), a === null && (a = Fl, o = $i(), a.pooledCache = o, o.refCount++, o !== null && (a.pooledCacheLanes |= n), a = o), t.memoizedState = {
				parent: r,
				cache: a
			}, Ma(t), zi(t, Qi, a)) : ((e.lanes & n) !== 0 && (Na(e, t), Ba(t, null, null, n), za()), a = e.memoizedState, o = t.memoizedState, a.parent === r ? (r = o.cache, zi(t, Qi, r), r !== a.cache && Hi(t, [Qi], n, !0)) : (a = {
				parent: r,
				cache: r
			}, t.memoizedState = a, t.lanes === 0 && (t.memoizedState = t.updateQueue.baseState = a), zi(t, Qi, r))), Qs(e, t, t.pendingProps.children, n), t.child;
			case 29: throw t.pendingProps;
		}
		throw Error(i(156, t.tag));
	}
	function Dc(e) {
		e.flags |= 4;
	}
	function Oc(e, t, n, r, i) {
		if ((t = (e.mode & 32) != 0) && (t = !1), t) {
			if (e.flags |= 16777216, (i & 335544128) === i) if (e.stateNode.complete) e.flags |= 8192;
			else if (Su()) e.flags |= 8192;
			else throw ba = ga, ma;
		} else e.flags &= -16777217;
	}
	function kc(e, t) {
		if (t.type !== "stylesheet" || t.state.loading & 4) e.flags &= -16777217;
		else if (e.flags |= 16777216, !Wf(t)) if (Su()) e.flags |= 8192;
		else throw ba = ga, ma;
	}
	function Ac(e, t) {
		t !== null && (e.flags |= 4), e.flags & 16384 && (t = e.tag === 22 ? 536870912 : Ue(), e.lanes |= t, ql |= t);
	}
	function jc(e, t) {
		if (!J) switch (e.tailMode) {
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
	function Mc(e) {
		var t = e.alternate !== null && e.alternate.child === e.child, n = 0, r = 0;
		if (t) for (var i = e.child; i !== null;) n |= i.lanes | i.childLanes, r |= i.subtreeFlags & 65011712, r |= i.flags & 65011712, i.return = e, i = i.sibling;
		else for (i = e.child; i !== null;) n |= i.lanes | i.childLanes, r |= i.subtreeFlags, r |= i.flags, i.return = e, i = i.sibling;
		return e.subtreeFlags |= r, e.childLanes = n, t;
	}
	function Nc(e, t, n) {
		var r = t.pendingProps;
		switch (Si(t), t.tag) {
			case 16:
			case 15:
			case 0:
			case 11:
			case 7:
			case 8:
			case 12:
			case 9:
			case 14: return Mc(t), null;
			case 1: return Mc(t), null;
			case 3: return n = t.stateNode, r = null, e !== null && (r = e.memoizedState.cache), t.memoizedState.cache !== r && (t.flags |= 2048), Bi(Qi), se(), n.pendingContext && (n.context = n.pendingContext, n.pendingContext = null), (e === null || e.child === null) && (Mi(t) ? Dc(t) : e === null || e.memoizedState.isDehydrated && !(t.flags & 256) || (t.flags |= 1024, Pi())), Mc(t), null;
			case 26:
				var a = t.type, o = t.memoizedState;
				return e === null ? (Dc(t), o === null ? (Mc(t), Oc(t, a, null, r, n)) : (Mc(t), kc(t, o))) : o ? o === e.memoizedState ? (Mc(t), t.flags &= -16777217) : (Dc(t), Mc(t), kc(t, o)) : (e = e.memoizedProps, e !== r && Dc(t), Mc(t), Oc(t, a, e, r, n)), null;
			case 27:
				if (le(t), n = ie.current, a = t.type, e !== null && t.stateNode != null) e.memoizedProps !== r && Dc(t);
				else {
					if (!r) {
						if (t.stateNode === null) throw Error(i(166));
						return Mc(t), null;
					}
					e = ne.current, Mi(t) ? Ai(t, e) : (e = ff(a, r, n), t.stateNode = e, Dc(t));
				}
				return Mc(t), null;
			case 5:
				if (le(t), a = t.type, e !== null && t.stateNode != null) e.memoizedProps !== r && Dc(t);
				else {
					if (!r) {
						if (t.stateNode === null) throw Error(i(166));
						return Mc(t), null;
					}
					if (o = ne.current, Mi(t)) Ai(t, o);
					else {
						var s = Bd(ie.current);
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
						o[tt] = t, o[nt] = r;
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
						r && Dc(t);
					}
				}
				return Mc(t), Oc(t, t.type, e === null ? null : e.memoizedProps, t.pendingProps, n), null;
			case 6:
				if (e && t.stateNode != null) e.memoizedProps !== r && Dc(t);
				else {
					if (typeof r != "string" && t.stateNode === null) throw Error(i(166));
					if (e = ie.current, Mi(t)) {
						if (e = t.stateNode, n = t.memoizedProps, r = null, a = wi, a !== null) switch (a.tag) {
							case 27:
							case 5: r = a.memoizedProps;
						}
						e[tt] = t, e = !!(e.nodeValue === n || r !== null && !0 === r.suppressHydrationWarning || jd(e.nodeValue, n)), e || ki(t, !0);
					} else e = Bd(e).createTextNode(r), e[tt] = t, t.stateNode = e;
				}
				return Mc(t), null;
			case 31:
				if (n = t.memoizedState, e === null || e.memoizedState !== null) {
					if (r = Mi(t), n !== null) {
						if (e === null) {
							if (!r) throw Error(i(318));
							if (e = t.memoizedState, e = e === null ? null : e.dehydrated, !e) throw Error(i(557));
							e[tt] = t;
						} else Ni(), !(t.flags & 128) && (t.memoizedState = null), t.flags |= 4;
						Mc(t), e = !1;
					} else n = Pi(), e !== null && e.memoizedState !== null && (e.memoizedState.hydrationErrors = n), e = !0;
					if (!e) return t.flags & 256 ? (eo(t), t) : (eo(t), null);
					if (t.flags & 128) throw Error(i(558));
				}
				return Mc(t), null;
			case 13:
				if (r = t.memoizedState, e === null || e.memoizedState !== null && e.memoizedState.dehydrated !== null) {
					if (a = Mi(t), r !== null && r.dehydrated !== null) {
						if (e === null) {
							if (!a) throw Error(i(318));
							if (a = t.memoizedState, a = a === null ? null : a.dehydrated, !a) throw Error(i(317));
							a[tt] = t;
						} else Ni(), !(t.flags & 128) && (t.memoizedState = null), t.flags |= 4;
						Mc(t), a = !1;
					} else a = Pi(), e !== null && e.memoizedState !== null && (e.memoizedState.hydrationErrors = a), a = !0;
					if (!a) return t.flags & 256 ? (eo(t), t) : (eo(t), null);
				}
				return eo(t), t.flags & 128 ? (t.lanes = n, t) : (n = r !== null, e = e !== null && e.memoizedState !== null, n && (r = t.child, a = null, r.alternate !== null && r.alternate.memoizedState !== null && r.alternate.memoizedState.cachePool !== null && (a = r.alternate.memoizedState.cachePool.pool), o = null, r.memoizedState !== null && r.memoizedState.cachePool !== null && (o = r.memoizedState.cachePool.pool), o !== a && (r.flags |= 2048)), n !== e && n && (t.child.flags |= 8192), Ac(t, t.updateQueue), Mc(t), null);
			case 4: return se(), e === null && xd(t.stateNode.containerInfo), Mc(t), null;
			case 10: return Bi(t.type), Mc(t), null;
			case 19:
				if (B(to), r = t.memoizedState, r === null) return Mc(t), null;
				if (a = (t.flags & 128) != 0, o = r.rendering, o === null) if (a) jc(r, !1);
				else {
					if (Hl !== 0 || e !== null && e.flags & 128) for (e = t.child; e !== null;) {
						if (o = no(e), o !== null) {
							for (t.flags |= 128, jc(r, !1), e = o.updateQueue, t.updateQueue = e, Ac(t, e), t.subtreeFlags = 0, e = n, n = t.child; n !== null;) ni(n, e), n = n.sibling;
							return V(to, to.current & 1 | 2), J && yi(t, r.treeForkCount), t.child;
						}
						e = e.sibling;
					}
					r.tail !== null && H() > $l && (t.flags |= 128, a = !0, jc(r, !1), t.lanes = 4194304);
				}
				else {
					if (!a) if (e = no(o), e !== null) {
						if (t.flags |= 128, a = !0, e = e.updateQueue, t.updateQueue = e, Ac(t, e), jc(r, !0), r.tail === null && r.tailMode === "hidden" && !o.alternate && !J) return Mc(t), null;
					} else 2 * H() - r.renderingStartTime > $l && n !== 536870912 && (t.flags |= 128, a = !0, jc(r, !1), t.lanes = 4194304);
					r.isBackwards ? (o.sibling = t.child, t.child = o) : (e = r.last, e === null ? t.child = o : e.sibling = o, r.last = o);
				}
				return r.tail === null ? (Mc(t), null) : (e = r.tail, r.rendering = e, r.tail = e.sibling, r.renderingStartTime = H(), e.sibling = null, n = to.current, V(to, a ? n & 1 | 2 : n & 1), J && yi(t, r.treeForkCount), e);
			case 22:
			case 23: return eo(t), qa(), r = t.memoizedState !== null, e === null ? r && (t.flags |= 8192) : e.memoizedState !== null !== r && (t.flags |= 8192), r ? n & 536870912 && !(t.flags & 128) && (Mc(t), t.subtreeFlags & 6 && (t.flags |= 8192)) : Mc(t), n = t.updateQueue, n !== null && Ac(t, n.retryQueue), n = null, e !== null && e.memoizedState !== null && e.memoizedState.cachePool !== null && (n = e.memoizedState.cachePool.pool), r = null, t.memoizedState !== null && t.memoizedState.cachePool !== null && (r = t.memoizedState.cachePool.pool), r !== n && (t.flags |= 2048), e !== null && B(la), null;
			case 24: return n = null, e !== null && (n = e.memoizedState.cache), t.memoizedState.cache !== n && (t.flags |= 2048), Bi(Qi), Mc(t), null;
			case 25: return null;
			case 30: return null;
		}
		throw Error(i(156, t.tag));
	}
	function Pc(e, t) {
		switch (Si(t), t.tag) {
			case 1: return e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
			case 3: return Bi(Qi), se(), e = t.flags, e & 65536 && !(e & 128) ? (t.flags = e & -65537 | 128, t) : null;
			case 26:
			case 27:
			case 5: return le(t), null;
			case 31:
				if (t.memoizedState !== null) {
					if (eo(t), t.alternate === null) throw Error(i(340));
					Ni();
				}
				return e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
			case 13:
				if (eo(t), e = t.memoizedState, e !== null && e.dehydrated !== null) {
					if (t.alternate === null) throw Error(i(340));
					Ni();
				}
				return e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
			case 19: return B(to), null;
			case 4: return se(), null;
			case 10: return Bi(t.type), null;
			case 22:
			case 23: return eo(t), qa(), e !== null && B(la), e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
			case 24: return Bi(Qi), null;
			case 25: return null;
			default: return null;
		}
	}
	function Fc(e, t) {
		switch (Si(t), t.tag) {
			case 3:
				Bi(Qi), se();
				break;
			case 26:
			case 27:
			case 5:
				le(t);
				break;
			case 4:
				se();
				break;
			case 31:
				t.memoizedState !== null && eo(t);
				break;
			case 13:
				eo(t);
				break;
			case 19:
				B(to);
				break;
			case 10:
				Bi(t.type);
				break;
			case 22:
			case 23:
				eo(t), qa(), e !== null && B(la);
				break;
			case 24: Bi(Qi);
		}
	}
	function Ic(e, t) {
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
			Uu(t, t.return, e);
		}
	}
	function Lc(e, t, n) {
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
								Uu(i, c, e);
							}
						}
					}
					r = r.next;
				} while (r !== a);
			}
		} catch (e) {
			Uu(t, t.return, e);
		}
	}
	function Rc(e) {
		var t = e.updateQueue;
		if (t !== null) {
			var n = e.stateNode;
			try {
				Ha(t, n);
			} catch (t) {
				Uu(e, e.return, t);
			}
		}
	}
	function zc(e, t, n) {
		n.props = Bs(e.type, e.memoizedProps), n.state = e.memoizedState;
		try {
			n.componentWillUnmount();
		} catch (n) {
			Uu(e, t, n);
		}
	}
	function Bc(e, t) {
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
			Uu(e, t, n);
		}
	}
	function Vc(e, t) {
		var n = e.ref, r = e.refCleanup;
		if (n !== null) if (typeof r == "function") try {
			r();
		} catch (n) {
			Uu(e, t, n);
		} finally {
			e.refCleanup = null, e = e.alternate, e != null && (e.refCleanup = null);
		}
		else if (typeof n == "function") try {
			n(null);
		} catch (n) {
			Uu(e, t, n);
		}
		else n.current = null;
	}
	function Hc(e) {
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
			Uu(e, e.return, t);
		}
	}
	function Uc(e, t, n) {
		try {
			var r = e.stateNode;
			Fd(r, e.type, n, t), r[nt] = t;
		} catch (t) {
			Uu(e, e.return, t);
		}
	}
	function Wc(e) {
		return e.tag === 5 || e.tag === 3 || e.tag === 26 || e.tag === 27 && Zd(e.type) || e.tag === 4;
	}
	function Gc(e) {
		a: for (;;) {
			for (; e.sibling === null;) {
				if (e.return === null || Wc(e.return)) return null;
				e = e.return;
			}
			for (e.sibling.return = e.return, e = e.sibling; e.tag !== 5 && e.tag !== 6 && e.tag !== 18;) {
				if (e.tag === 27 && Zd(e.type) || e.flags & 2 || e.child === null || e.tag === 4) continue a;
				e.child.return = e, e = e.child;
			}
			if (!(e.flags & 2)) return e.stateNode;
		}
	}
	function Kc(e, t, n) {
		var r = e.tag;
		if (r === 5 || r === 6) e = e.stateNode, t ? (n.nodeType === 9 ? n.body : n.nodeName === "HTML" ? n.ownerDocument.body : n).insertBefore(e, t) : (t = n.nodeType === 9 ? n.body : n.nodeName === "HTML" ? n.ownerDocument.body : n, t.appendChild(e), n = n._reactRootContainer, n != null || t.onclick !== null || (t.onclick = Kt));
		else if (r !== 4 && (r === 27 && Zd(e.type) && (n = e.stateNode, t = null), e = e.child, e !== null)) for (Kc(e, t, n), e = e.sibling; e !== null;) Kc(e, t, n), e = e.sibling;
	}
	function qc(e, t, n) {
		var r = e.tag;
		if (r === 5 || r === 6) e = e.stateNode, t ? n.insertBefore(e, t) : n.appendChild(e);
		else if (r !== 4 && (r === 27 && Zd(e.type) && (n = e.stateNode), e = e.child, e !== null)) for (qc(e, t, n), e = e.sibling; e !== null;) qc(e, t, n), e = e.sibling;
	}
	function Jc(e) {
		var t = e.stateNode, n = e.memoizedProps;
		try {
			for (var r = e.type, i = t.attributes; i.length;) t.removeAttributeNode(i[0]);
			Pd(t, r, n), t[tt] = e, t[nt] = n;
		} catch (t) {
			Uu(e, e.return, t);
		}
	}
	var Yc = !1, Xc = !1, Zc = !1, Qc = typeof WeakSet == "function" ? WeakSet : Set, $c = null;
	function el(e, t) {
		if (e = e.containerInfo, Rd = sp, e = br(e), xr(e)) {
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
		}, sp = !1, $c = t; $c !== null;) if (t = $c, e = t.child, t.subtreeFlags & 1028 && e !== null) e.return = t, $c = e;
		else for (; $c !== null;) {
			switch (t = $c, o = t.alternate, e = t.flags, t.tag) {
				case 0:
					if (e & 4 && (e = t.updateQueue, e = e === null ? null : e.events, e !== null)) for (n = 0; n < e.length; n++) a = e[n], a.ref.impl = a.nextImpl;
					break;
				case 11:
				case 15: break;
				case 1:
					if (e & 1024 && o !== null) {
						e = void 0, n = t, a = o.memoizedProps, o = o.memoizedState, r = n.stateNode;
						try {
							var h = Bs(n.type, a);
							e = r.getSnapshotBeforeUpdate(h, o), r.__reactInternalSnapshotBeforeUpdate = e;
						} catch (e) {
							Uu(n, n.return, e);
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
				e.return = t.return, $c = e;
				break;
			}
			$c = t.return;
		}
	}
	function tl(e, t, n) {
		var r = n.flags;
		switch (n.tag) {
			case 0:
			case 11:
			case 15:
				gl(e, n), r & 4 && Ic(5, n);
				break;
			case 1:
				if (gl(e, n), r & 4) if (e = n.stateNode, t === null) try {
					e.componentDidMount();
				} catch (e) {
					Uu(n, n.return, e);
				}
				else {
					var i = Bs(n.type, t.memoizedProps);
					t = t.memoizedState;
					try {
						e.componentDidUpdate(i, t, e.__reactInternalSnapshotBeforeUpdate);
					} catch (e) {
						Uu(n, n.return, e);
					}
				}
				r & 64 && Rc(n), r & 512 && Bc(n, n.return);
				break;
			case 3:
				if (gl(e, n), r & 64 && (e = n.updateQueue, e !== null)) {
					if (t = null, n.child !== null) switch (n.child.tag) {
						case 27:
						case 5:
							t = n.child.stateNode;
							break;
						case 1: t = n.child.stateNode;
					}
					try {
						Ha(e, t);
					} catch (e) {
						Uu(n, n.return, e);
					}
				}
				break;
			case 27: t === null && r & 4 && Jc(n);
			case 26:
			case 5:
				gl(e, n), t === null && r & 4 && Hc(n), r & 512 && Bc(n, n.return);
				break;
			case 12:
				gl(e, n);
				break;
			case 31:
				gl(e, n), r & 4 && sl(e, n);
				break;
			case 13:
				gl(e, n), r & 4 && cl(e, n), r & 64 && (e = n.memoizedState, e !== null && (e = e.dehydrated, e !== null && (n = qu.bind(null, n), sf(e, n))));
				break;
			case 22:
				if (r = n.memoizedState !== null || Yc, !r) {
					t = t !== null && t.memoizedState !== null || Xc, i = Yc;
					var a = Xc;
					Yc = r, (Xc = t) && !a ? vl(e, n, (n.subtreeFlags & 8772) != 0) : gl(e, n), Yc = i, Xc = a;
				}
				break;
			case 30: break;
			default: gl(e, n);
		}
	}
	function nl(e) {
		var t = e.alternate;
		t !== null && (e.alternate = null, nl(t)), e.child = null, e.deletions = null, e.sibling = null, e.tag === 5 && (t = e.stateNode, t !== null && st(t)), e.stateNode = null, e.return = null, e.dependencies = null, e.memoizedProps = null, e.memoizedState = null, e.pendingProps = null, e.stateNode = null, e.updateQueue = null;
	}
	var rl = null, il = !1;
	function al(e, t, n) {
		for (n = n.child; n !== null;) ol(e, t, n), n = n.sibling;
	}
	function ol(e, t, n) {
		if (je && typeof je.onCommitFiberUnmount == "function") try {
			je.onCommitFiberUnmount(Ae, n);
		} catch {}
		switch (n.tag) {
			case 26:
				Xc || Vc(n, t), al(e, t, n), n.memoizedState ? n.memoizedState.count-- : n.stateNode && (n = n.stateNode, n.parentNode.removeChild(n));
				break;
			case 27:
				Xc || Vc(n, t);
				var r = rl, i = il;
				Zd(n.type) && (rl = n.stateNode, il = !1), al(e, t, n), pf(n.stateNode), rl = r, il = i;
				break;
			case 5: Xc || Vc(n, t);
			case 6:
				if (r = rl, i = il, rl = null, al(e, t, n), rl = r, il = i, rl !== null) if (il) try {
					(rl.nodeType === 9 ? rl.body : rl.nodeName === "HTML" ? rl.ownerDocument.body : rl).removeChild(n.stateNode);
				} catch (e) {
					Uu(n, t, e);
				}
				else try {
					rl.removeChild(n.stateNode);
				} catch (e) {
					Uu(n, t, e);
				}
				break;
			case 18:
				rl !== null && (il ? (e = rl, Qd(e.nodeType === 9 ? e.body : e.nodeName === "HTML" ? e.ownerDocument.body : e, n.stateNode), Np(e)) : Qd(rl, n.stateNode));
				break;
			case 4:
				r = rl, i = il, rl = n.stateNode.containerInfo, il = !0, al(e, t, n), rl = r, il = i;
				break;
			case 0:
			case 11:
			case 14:
			case 15:
				Lc(2, n, t), Xc || Lc(4, n, t), al(e, t, n);
				break;
			case 1:
				Xc || (Vc(n, t), r = n.stateNode, typeof r.componentWillUnmount == "function" && zc(n, t, r)), al(e, t, n);
				break;
			case 21:
				al(e, t, n);
				break;
			case 22:
				Xc = (r = Xc) || n.memoizedState !== null, al(e, t, n), Xc = r;
				break;
			default: al(e, t, n);
		}
	}
	function sl(e, t) {
		if (t.memoizedState === null && (e = t.alternate, e !== null && (e = e.memoizedState, e !== null))) {
			e = e.dehydrated;
			try {
				Np(e);
			} catch (e) {
				Uu(t, t.return, e);
			}
		}
	}
	function cl(e, t) {
		if (t.memoizedState === null && (e = t.alternate, e !== null && (e = e.memoizedState, e !== null && (e = e.dehydrated, e !== null)))) try {
			Np(e);
		} catch (e) {
			Uu(t, t.return, e);
		}
	}
	function ll(e) {
		switch (e.tag) {
			case 31:
			case 13:
			case 19:
				var t = e.stateNode;
				return t === null && (t = e.stateNode = new Qc()), t;
			case 22: return e = e.stateNode, t = e._retryCache, t === null && (t = e._retryCache = new Qc()), t;
			default: throw Error(i(435, e.tag));
		}
	}
	function ul(e, t) {
		var n = ll(e);
		t.forEach(function(t) {
			if (!n.has(t)) {
				n.add(t);
				var r = Ju.bind(null, e, t);
				t.then(r, r);
			}
		});
	}
	function dl(e, t) {
		var n = t.deletions;
		if (n !== null) for (var r = 0; r < n.length; r++) {
			var a = n[r], o = e, s = t, c = s;
			a: for (; c !== null;) {
				switch (c.tag) {
					case 27:
						if (Zd(c.type)) {
							rl = c.stateNode, il = !1;
							break a;
						}
						break;
					case 5:
						rl = c.stateNode, il = !1;
						break a;
					case 3:
					case 4:
						rl = c.stateNode.containerInfo, il = !0;
						break a;
				}
				c = c.return;
			}
			if (rl === null) throw Error(i(160));
			ol(o, s, a), rl = null, il = !1, o = a.alternate, o !== null && (o.return = null), a.return = null;
		}
		if (t.subtreeFlags & 13886) for (t = t.child; t !== null;) pl(t, e), t = t.sibling;
	}
	var fl = null;
	function pl(e, t) {
		var n = e.alternate, r = e.flags;
		switch (e.tag) {
			case 0:
			case 11:
			case 14:
			case 15:
				dl(t, e), ml(e), r & 4 && (Lc(3, e, e.return), Ic(3, e), Lc(5, e, e.return));
				break;
			case 1:
				dl(t, e), ml(e), r & 512 && (Xc || n === null || Vc(n, n.return)), r & 64 && Yc && (e = e.updateQueue, e !== null && (r = e.callbacks, r !== null && (n = e.shared.hiddenCallbacks, e.shared.hiddenCallbacks = n === null ? r : n.concat(r))));
				break;
			case 26:
				var a = fl;
				if (dl(t, e), ml(e), r & 512 && (Xc || n === null || Vc(n, n.return)), r & 4) {
					var o = n === null ? null : n.memoizedState;
					if (r = e.memoizedState, n === null) if (r === null) if (e.stateNode === null) {
						a: {
							r = e.type, n = e.memoizedProps, a = a.ownerDocument || a;
							b: switch (r) {
								case "title":
									o = a.getElementsByTagName("title")[0], (!o || o[ot] || o[tt] || o.namespaceURI === "http://www.w3.org/2000/svg" || o.hasAttribute("itemprop")) && (o = a.createElement(r), a.head.insertBefore(o, a.querySelector("head > title"))), Pd(o, r, n), o[tt] = e, ft(o), r = o;
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
							o[tt] = e, ft(o), r = o;
						}
						e.stateNode = r;
					} else Hf(a, e.type, e.stateNode);
					else e.stateNode = If(a, r, e.memoizedProps);
					else o === r ? r === null && e.stateNode !== null && Uc(e, e.memoizedProps, n.memoizedProps) : (o === null ? n.stateNode !== null && (n = n.stateNode, n.parentNode.removeChild(n)) : o.count--, r === null ? Hf(a, e.type, e.stateNode) : If(a, r, e.memoizedProps));
				}
				break;
			case 27:
				dl(t, e), ml(e), r & 512 && (Xc || n === null || Vc(n, n.return)), n !== null && r & 4 && Uc(e, e.memoizedProps, n.memoizedProps);
				break;
			case 5:
				if (dl(t, e), ml(e), r & 512 && (Xc || n === null || Vc(n, n.return)), e.flags & 32) {
					a = e.stateNode;
					try {
						Rt(a, "");
					} catch (t) {
						Uu(e, e.return, t);
					}
				}
				r & 4 && e.stateNode != null && (a = e.memoizedProps, Uc(e, a, n === null ? a : n.memoizedProps)), r & 1024 && (Zc = !0);
				break;
			case 6:
				if (dl(t, e), ml(e), r & 4) {
					if (e.stateNode === null) throw Error(i(162));
					r = e.memoizedProps, n = e.stateNode;
					try {
						n.nodeValue = r;
					} catch (t) {
						Uu(e, e.return, t);
					}
				}
				break;
			case 3:
				if (Bf = null, a = fl, fl = gf(t.containerInfo), dl(t, e), fl = a, ml(e), r & 4 && n !== null && n.memoizedState.isDehydrated) try {
					Np(t.containerInfo);
				} catch (t) {
					Uu(e, e.return, t);
				}
				Zc && (Zc = !1, hl(e));
				break;
			case 4:
				r = fl, fl = gf(e.stateNode.containerInfo), dl(t, e), ml(e), fl = r;
				break;
			case 12:
				dl(t, e), ml(e);
				break;
			case 31:
				dl(t, e), ml(e), r & 4 && (r = e.updateQueue, r !== null && (e.updateQueue = null, ul(e, r)));
				break;
			case 13:
				dl(t, e), ml(e), e.child.flags & 8192 && e.memoizedState !== null != (n !== null && n.memoizedState !== null) && (Zl = H()), r & 4 && (r = e.updateQueue, r !== null && (e.updateQueue = null, ul(e, r)));
				break;
			case 22:
				a = e.memoizedState !== null;
				var l = n !== null && n.memoizedState !== null, u = Yc, d = Xc;
				if (Yc = u || a, Xc = d || l, dl(t, e), Xc = d, Yc = u, ml(e), r & 8192) a: for (t = e.stateNode, t._visibility = a ? t._visibility & -2 : t._visibility | 1, a && (n === null || l || Yc || Xc || _l(e)), n = null, t = e;;) {
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
								Uu(l, l.return, e);
							}
						}
					} else if (t.tag === 6) {
						if (n === null) {
							l = t;
							try {
								l.stateNode.nodeValue = a ? "" : l.memoizedProps;
							} catch (e) {
								Uu(l, l.return, e);
							}
						}
					} else if (t.tag === 18) {
						if (n === null) {
							l = t;
							try {
								var m = l.stateNode;
								a ? $d(m, !0) : $d(l.stateNode, !1);
							} catch (e) {
								Uu(l, l.return, e);
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
				r & 4 && (r = e.updateQueue, r !== null && (n = r.retryQueue, n !== null && (r.retryQueue = null, ul(e, n))));
				break;
			case 19:
				dl(t, e), ml(e), r & 4 && (r = e.updateQueue, r !== null && (e.updateQueue = null, ul(e, r)));
				break;
			case 30: break;
			case 21: break;
			default: dl(t, e), ml(e);
		}
	}
	function ml(e) {
		var t = e.flags;
		if (t & 2) {
			try {
				for (var n, r = e.return; r !== null;) {
					if (Wc(r)) {
						n = r;
						break;
					}
					r = r.return;
				}
				if (n == null) throw Error(i(160));
				switch (n.tag) {
					case 27:
						var a = n.stateNode;
						qc(e, Gc(e), a);
						break;
					case 5:
						var o = n.stateNode;
						n.flags & 32 && (Rt(o, ""), n.flags &= -33), qc(e, Gc(e), o);
						break;
					case 3:
					case 4:
						var s = n.stateNode.containerInfo;
						Kc(e, Gc(e), s);
						break;
					default: throw Error(i(161));
				}
			} catch (t) {
				Uu(e, e.return, t);
			}
			e.flags &= -3;
		}
		t & 4096 && (e.flags &= -4097);
	}
	function hl(e) {
		if (e.subtreeFlags & 1024) for (e = e.child; e !== null;) {
			var t = e;
			hl(t), t.tag === 5 && t.flags & 1024 && t.stateNode.reset(), e = e.sibling;
		}
	}
	function gl(e, t) {
		if (t.subtreeFlags & 8772) for (t = t.child; t !== null;) tl(e, t.alternate, t), t = t.sibling;
	}
	function _l(e) {
		for (e = e.child; e !== null;) {
			var t = e;
			switch (t.tag) {
				case 0:
				case 11:
				case 14:
				case 15:
					Lc(4, t, t.return), _l(t);
					break;
				case 1:
					Vc(t, t.return);
					var n = t.stateNode;
					typeof n.componentWillUnmount == "function" && zc(t, t.return, n), _l(t);
					break;
				case 27: pf(t.stateNode);
				case 26:
				case 5:
					Vc(t, t.return), _l(t);
					break;
				case 22:
					t.memoizedState === null && _l(t);
					break;
				case 30:
					_l(t);
					break;
				default: _l(t);
			}
			e = e.sibling;
		}
	}
	function vl(e, t, n) {
		for (n &&= (t.subtreeFlags & 8772) != 0, t = t.child; t !== null;) {
			var r = t.alternate, i = e, a = t, o = a.flags;
			switch (a.tag) {
				case 0:
				case 11:
				case 15:
					vl(i, a, n), Ic(4, a);
					break;
				case 1:
					if (vl(i, a, n), r = a, i = r.stateNode, typeof i.componentDidMount == "function") try {
						i.componentDidMount();
					} catch (e) {
						Uu(r, r.return, e);
					}
					if (r = a, i = r.updateQueue, i !== null) {
						var s = r.stateNode;
						try {
							var c = i.shared.hiddenCallbacks;
							if (c !== null) for (i.shared.hiddenCallbacks = null, i = 0; i < c.length; i++) Va(c[i], s);
						} catch (e) {
							Uu(r, r.return, e);
						}
					}
					n && o & 64 && Rc(a), Bc(a, a.return);
					break;
				case 27: Jc(a);
				case 26:
				case 5:
					vl(i, a, n), n && r === null && o & 4 && Hc(a), Bc(a, a.return);
					break;
				case 12:
					vl(i, a, n);
					break;
				case 31:
					vl(i, a, n), n && o & 4 && sl(i, a);
					break;
				case 13:
					vl(i, a, n), n && o & 4 && cl(i, a);
					break;
				case 22:
					a.memoizedState === null && vl(i, a, n), Bc(a, a.return);
					break;
				case 30: break;
				default: vl(i, a, n);
			}
			t = t.sibling;
		}
	}
	function yl(e, t) {
		var n = null;
		e !== null && e.memoizedState !== null && e.memoizedState.cachePool !== null && (n = e.memoizedState.cachePool.pool), e = null, t.memoizedState !== null && t.memoizedState.cachePool !== null && (e = t.memoizedState.cachePool.pool), e !== n && (e != null && e.refCount++, n != null && ea(n));
	}
	function bl(e, t) {
		e = null, t.alternate !== null && (e = t.alternate.memoizedState.cache), t = t.memoizedState.cache, t !== e && (t.refCount++, e != null && ea(e));
	}
	function xl(e, t, n, r) {
		if (t.subtreeFlags & 10256) for (t = t.child; t !== null;) Sl(e, t, n, r), t = t.sibling;
	}
	function Sl(e, t, n, r) {
		var i = t.flags;
		switch (t.tag) {
			case 0:
			case 11:
			case 15:
				xl(e, t, n, r), i & 2048 && Ic(9, t);
				break;
			case 1:
				xl(e, t, n, r);
				break;
			case 3:
				xl(e, t, n, r), i & 2048 && (e = null, t.alternate !== null && (e = t.alternate.memoizedState.cache), t = t.memoizedState.cache, t !== e && (t.refCount++, e != null && ea(e)));
				break;
			case 12:
				if (i & 2048) {
					xl(e, t, n, r), e = t.stateNode;
					try {
						var a = t.memoizedProps, o = a.id, s = a.onPostCommit;
						typeof s == "function" && s(o, t.alternate === null ? "mount" : "update", e.passiveEffectDuration, -0);
					} catch (e) {
						Uu(t, t.return, e);
					}
				} else xl(e, t, n, r);
				break;
			case 31:
				xl(e, t, n, r);
				break;
			case 13:
				xl(e, t, n, r);
				break;
			case 23: break;
			case 22:
				a = t.stateNode, o = t.alternate, t.memoizedState === null ? a._visibility & 2 ? xl(e, t, n, r) : (a._visibility |= 2, Cl(e, t, n, r, (t.subtreeFlags & 10256) != 0 || !1)) : a._visibility & 2 ? xl(e, t, n, r) : wl(e, t), i & 2048 && yl(o, t);
				break;
			case 24:
				xl(e, t, n, r), i & 2048 && bl(t.alternate, t);
				break;
			default: xl(e, t, n, r);
		}
	}
	function Cl(e, t, n, r, i) {
		for (i &&= (t.subtreeFlags & 10256) != 0 || !1, t = t.child; t !== null;) {
			var a = e, o = t, s = n, c = r, l = o.flags;
			switch (o.tag) {
				case 0:
				case 11:
				case 15:
					Cl(a, o, s, c, i), Ic(8, o);
					break;
				case 23: break;
				case 22:
					var u = o.stateNode;
					o.memoizedState === null ? (u._visibility |= 2, Cl(a, o, s, c, i)) : u._visibility & 2 ? Cl(a, o, s, c, i) : wl(a, o), i && l & 2048 && yl(o.alternate, o);
					break;
				case 24:
					Cl(a, o, s, c, i), i && l & 2048 && bl(o.alternate, o);
					break;
				default: Cl(a, o, s, c, i);
			}
			t = t.sibling;
		}
	}
	function wl(e, t) {
		if (t.subtreeFlags & 10256) for (t = t.child; t !== null;) {
			var n = e, r = t, i = r.flags;
			switch (r.tag) {
				case 22:
					wl(n, r), i & 2048 && yl(r.alternate, r);
					break;
				case 24:
					wl(n, r), i & 2048 && bl(r.alternate, r);
					break;
				default: wl(n, r);
			}
			t = t.sibling;
		}
	}
	var Tl = 8192;
	function El(e, t, n) {
		if (e.subtreeFlags & Tl) for (e = e.child; e !== null;) Dl(e, t, n), e = e.sibling;
	}
	function Dl(e, t, n) {
		switch (e.tag) {
			case 26:
				El(e, t, n), e.flags & Tl && e.memoizedState !== null && Gf(n, fl, e.memoizedState, e.memoizedProps);
				break;
			case 5:
				El(e, t, n);
				break;
			case 3:
			case 4:
				var r = fl;
				fl = gf(e.stateNode.containerInfo), El(e, t, n), fl = r;
				break;
			case 22:
				e.memoizedState === null && (r = e.alternate, r !== null && r.memoizedState !== null ? (r = Tl, Tl = 16777216, El(e, t, n), Tl = r) : El(e, t, n));
				break;
			default: El(e, t, n);
		}
	}
	function Ol(e) {
		var t = e.alternate;
		if (t !== null && (e = t.child, e !== null)) {
			t.child = null;
			do
				t = e.sibling, e.sibling = null, e = t;
			while (e !== null);
		}
	}
	function kl(e) {
		var t = e.deletions;
		if (e.flags & 16) {
			if (t !== null) for (var n = 0; n < t.length; n++) {
				var r = t[n];
				$c = r, Ml(r, e);
			}
			Ol(e);
		}
		if (e.subtreeFlags & 10256) for (e = e.child; e !== null;) Al(e), e = e.sibling;
	}
	function Al(e) {
		switch (e.tag) {
			case 0:
			case 11:
			case 15:
				kl(e), e.flags & 2048 && Lc(9, e, e.return);
				break;
			case 3:
				kl(e);
				break;
			case 12:
				kl(e);
				break;
			case 22:
				var t = e.stateNode;
				e.memoizedState !== null && t._visibility & 2 && (e.return === null || e.return.tag !== 13) ? (t._visibility &= -3, jl(e)) : kl(e);
				break;
			default: kl(e);
		}
	}
	function jl(e) {
		var t = e.deletions;
		if (e.flags & 16) {
			if (t !== null) for (var n = 0; n < t.length; n++) {
				var r = t[n];
				$c = r, Ml(r, e);
			}
			Ol(e);
		}
		for (e = e.child; e !== null;) {
			switch (t = e, t.tag) {
				case 0:
				case 11:
				case 15:
					Lc(8, t, t.return), jl(t);
					break;
				case 22:
					n = t.stateNode, n._visibility & 2 && (n._visibility &= -3, jl(t));
					break;
				default: jl(t);
			}
			e = e.sibling;
		}
	}
	function Ml(e, t) {
		for (; $c !== null;) {
			var n = $c;
			switch (n.tag) {
				case 0:
				case 11:
				case 15:
					Lc(8, n, t);
					break;
				case 23:
				case 22:
					if (n.memoizedState !== null && n.memoizedState.cachePool !== null) {
						var r = n.memoizedState.cachePool.pool;
						r != null && r.refCount++;
					}
					break;
				case 24: ea(n.memoizedState.cache);
			}
			if (r = n.child, r !== null) r.return = n, $c = r;
			else a: for (n = e; $c !== null;) {
				r = $c;
				var i = r.sibling, a = r.return;
				if (nl(r), r === n) {
					$c = null;
					break a;
				}
				if (i !== null) {
					i.return = a, $c = i;
					break a;
				}
				$c = a;
			}
		}
	}
	var Nl = {
		getCacheForType: function(e) {
			var t = Ki(Qi), n = t.data.get(e);
			return n === void 0 && (n = e(), t.data.set(e, n)), n;
		},
		cacheSignal: function() {
			return Ki(Qi).controller.signal;
		}
	}, Pl = typeof WeakMap == "function" ? WeakMap : Map, X = 0, Fl = null, Z = null, Q = 0, Il = 0, Ll = null, Rl = !1, zl = !1, Bl = !1, Vl = 0, Hl = 0, Ul = 0, Wl = 0, Gl = 0, Kl = 0, ql = 0, Jl = null, Yl = null, Xl = !1, Zl = 0, Ql = 0, $l = Infinity, eu = null, tu = null, nu = 0, ru = null, iu = null, au = 0, ou = 0, su = null, cu = null, lu = 0, uu = null;
	function du() {
		return X & 2 && Q !== 0 ? Q & -Q : I.T === null ? Qe() : ud();
	}
	function fu() {
		if (Kl === 0) if (!(Q & 536870912) || J) {
			var e = Le;
			Le <<= 1, !(Le & 3932160) && (Le = 262144), Kl = e;
		} else Kl = 536870912;
		return e = Ja.current, e !== null && (e.flags |= 32), Kl;
	}
	function pu(e, t, n) {
		(e === Fl && (Il === 2 || Il === 9) || e.cancelPendingCommit !== null) && (bu(e, 0), _u(e, Q, Kl, !1)), Ge(e, n), (!(X & 2) || e !== Fl) && (e === Fl && (!(X & 2) && (Wl |= n), Hl === 4 && _u(e, Q, Kl, !1)), nd(e));
	}
	function mu(e, t, n) {
		if (X & 6) throw Error(i(327));
		var r = !n && (t & 127) == 0 && (t & e.expiredLanes) === 0 || Ve(e, t), a = r ? Ou(e, t) : Eu(e, t, !0), o = r;
		do {
			if (a === 0) {
				zl && !r && _u(e, t, 0, !1);
				break;
			} else {
				if (n = e.current.alternate, o && !gu(n)) {
					a = Eu(e, t, !1), o = !1;
					continue;
				}
				if (a === 2) {
					if (o = t, e.errorRecoveryDisabledLanes & o) var s = 0;
					else s = e.pendingLanes & -536870913, s = s === 0 ? s & 536870912 ? 536870912 : 0 : s;
					if (s !== 0) {
						t = s;
						a: {
							var c = e;
							a = Jl;
							var l = c.current.memoizedState.isDehydrated;
							if (l && (bu(c, s).flags |= 256), s = Eu(c, s, !1), s !== 2) {
								if (Bl && !l) {
									c.errorRecoveryDisabledLanes |= o, Wl |= o, a = 4;
									break a;
								}
								o = Yl, Yl = a, o !== null && (Yl === null ? Yl = o : Yl.push.apply(Yl, o));
							}
							a = s;
						}
						if (o = !1, a !== 2) continue;
					}
				}
				if (a === 1) {
					bu(e, 0), _u(e, t, 0, !0);
					break;
				}
				a: {
					switch (r = e, o = a, o) {
						case 0:
						case 1: throw Error(i(345));
						case 4: if ((t & 4194048) !== t) break;
						case 6:
							_u(r, t, Kl, !Rl);
							break a;
						case 2:
							Yl = null;
							break;
						case 3:
						case 5: break;
						default: throw Error(i(329));
					}
					if ((t & 62914560) === t && (a = Zl + 300 - H(), 10 < a)) {
						if (_u(r, t, Kl, !Rl), Be(r, 0, !0) !== 0) break a;
						au = t, r.timeoutHandle = Kd(hu.bind(null, r, n, Yl, eu, Xl, t, Kl, Wl, ql, Rl, o, "Throttled", -0, 0), a);
						break a;
					}
					hu(r, n, Yl, eu, Xl, t, Kl, Wl, ql, Rl, o, null, -0, 0);
				}
			}
			break;
		} while (1);
		nd(e);
	}
	function hu(e, t, n, r, i, a, o, s, c, l, u, d, f, p) {
		if (e.timeoutHandle = -1, d = t.subtreeFlags, d & 8192 || (d & 16785408) == 16785408) {
			d = {
				stylesheets: null,
				count: 0,
				imgCount: 0,
				imgBytes: 0,
				suspenseyImages: [],
				waitingForImages: !0,
				waitingForViewTransition: !1,
				unsuspend: Kt
			}, Dl(t, a, d);
			var m = (a & 62914560) === a ? Zl - H() : (a & 4194048) === a ? Ql - H() : 0;
			if (m = qf(d, m), m !== null) {
				au = a, e.cancelPendingCommit = m(Fu.bind(null, e, t, a, n, r, i, o, s, c, u, d, null, f, p)), _u(e, a, o, !l);
				return;
			}
		}
		Fu(e, t, a, n, r, i, o, s, c);
	}
	function gu(e) {
		for (var t = e;;) {
			var n = t.tag;
			if ((n === 0 || n === 11 || n === 15) && t.flags & 16384 && (n = t.updateQueue, n !== null && (n = n.stores, n !== null))) for (var r = 0; r < n.length; r++) {
				var i = n[r], a = i.getSnapshot;
				i = i.value;
				try {
					if (!hr(a(), i)) return !1;
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
	function _u(e, t, n, r) {
		t &= ~Gl, t &= ~Wl, e.suspendedLanes |= t, e.pingedLanes &= ~t, r && (e.warmLanes |= t), r = e.expirationTimes;
		for (var i = t; 0 < i;) {
			var a = 31 - U(i), o = 1 << a;
			r[a] = -1, i &= ~o;
		}
		n !== 0 && qe(e, n, t);
	}
	function vu() {
		return X & 6 ? !0 : (rd(0, !1), !1);
	}
	function yu() {
		if (Z !== null) {
			if (Il === 0) var e = Z.return;
			else e = Z, Ri = Li = null, So(e), Ca = null, wa = 0, e = Z;
			for (; e !== null;) Fc(e.alternate, e), e = e.return;
			Z = null;
		}
	}
	function bu(e, t) {
		var n = e.timeoutHandle;
		n !== -1 && (e.timeoutHandle = -1, qd(n)), n = e.cancelPendingCommit, n !== null && (e.cancelPendingCommit = null, n()), au = 0, yu(), Fl = e, Z = n = ti(e.current, null), Q = t, Il = 0, Ll = null, Rl = !1, zl = Ve(e, t), Bl = !1, ql = Kl = Gl = Wl = Ul = Hl = 0, Yl = Jl = null, Xl = !1, t & 8 && (t |= t & 32);
		var r = e.entangledLanes;
		if (r !== 0) for (e = e.entanglements, r &= t; 0 < r;) {
			var i = 31 - U(r), a = 1 << i;
			t |= e[i], r &= ~a;
		}
		return Vl = t, Gr(), n;
	}
	function xu(e, t) {
		Y = null, I.H = Ms, t === pa || t === ha ? (t = xa(), Il = 3) : t === ma ? (t = xa(), Il = 4) : Il = t === Xs ? 8 : typeof t == "object" && t && typeof t.then == "function" ? 6 : 1, Ll = t, Z === null && (Hl = 1, Ws(e, li(t, e.current)));
	}
	function Su() {
		var e = Ja.current;
		return e === null ? !0 : (Q & 4194048) === Q ? Ya === null : (Q & 62914560) === Q || Q & 536870912 ? e === Ya : !1;
	}
	function Cu() {
		var e = I.H;
		return I.H = Ms, e === null ? Ms : e;
	}
	function wu() {
		var e = I.A;
		return I.A = Nl, e;
	}
	function Tu() {
		Hl = 4, Rl || (Q & 4194048) !== Q && Ja.current !== null || (zl = !0), !(Ul & 134217727) && !(Wl & 134217727) || Fl === null || _u(Fl, Q, Kl, !1);
	}
	function Eu(e, t, n) {
		var r = X;
		X |= 2;
		var i = Cu(), a = wu();
		(Fl !== e || Q !== t) && (eu = null, bu(e, t)), t = !1;
		var o = Hl;
		a: do
			try {
				if (Il !== 0 && Z !== null) {
					var s = Z, c = Ll;
					switch (Il) {
						case 8:
							yu(), o = 6;
							break a;
						case 3:
						case 2:
						case 9:
						case 6:
							Ja.current === null && (t = !0);
							var l = Il;
							if (Il = 0, Ll = null, Mu(e, s, c, l), n && zl) {
								o = 0;
								break a;
							}
							break;
						default: l = Il, Il = 0, Ll = null, Mu(e, s, c, l);
					}
				}
				Du(), o = Hl;
				break;
			} catch (t) {
				xu(e, t);
			}
		while (1);
		return t && e.shellSuspendCounter++, Ri = Li = null, X = r, I.H = i, I.A = a, Z === null && (Fl = null, Q = 0, Gr()), o;
	}
	function Du() {
		for (; Z !== null;) Au(Z);
	}
	function Ou(e, t) {
		var n = X;
		X |= 2;
		var r = Cu(), a = wu();
		Fl !== e || Q !== t ? (eu = null, $l = H() + 500, bu(e, t)) : zl = Ve(e, t);
		a: do
			try {
				if (Il !== 0 && Z !== null) {
					t = Z;
					var o = Ll;
					b: switch (Il) {
						case 1:
							Il = 0, Ll = null, Mu(e, t, o, 1);
							break;
						case 2:
						case 9:
							if (_a(o)) {
								Il = 0, Ll = null, ju(t);
								break;
							}
							t = function() {
								Il !== 2 && Il !== 9 || Fl !== e || (Il = 7), nd(e);
							}, o.then(t, t);
							break a;
						case 3:
							Il = 7;
							break a;
						case 4:
							Il = 5;
							break a;
						case 7:
							_a(o) ? (Il = 0, Ll = null, ju(t)) : (Il = 0, Ll = null, Mu(e, t, o, 7));
							break;
						case 5:
							var s = null;
							switch (Z.tag) {
								case 26: s = Z.memoizedState;
								case 5:
								case 27:
									var c = Z;
									if (s ? Wf(s) : c.stateNode.complete) {
										Il = 0, Ll = null;
										var l = c.sibling;
										if (l !== null) Z = l;
										else {
											var u = c.return;
											u === null ? Z = null : (Z = u, Nu(u));
										}
										break b;
									}
							}
							Il = 0, Ll = null, Mu(e, t, o, 5);
							break;
						case 6:
							Il = 0, Ll = null, Mu(e, t, o, 6);
							break;
						case 8:
							yu(), Hl = 6;
							break a;
						default: throw Error(i(462));
					}
				}
				ku();
				break;
			} catch (t) {
				xu(e, t);
			}
		while (1);
		return Ri = Li = null, I.H = r, I.A = a, X = n, Z === null ? (Fl = null, Q = 0, Gr(), Hl) : 0;
	}
	function ku() {
		for (; Z !== null && !be();) Au(Z);
	}
	function Au(e) {
		var t = Ec(e.alternate, e, Vl);
		e.memoizedProps = e.pendingProps, t === null ? Nu(e) : Z = t;
	}
	function ju(e) {
		var t = e, n = t.alternate;
		switch (t.tag) {
			case 15:
			case 0:
				t = uc(n, t, t.pendingProps, t.type, void 0, Q);
				break;
			case 11:
				t = uc(n, t, t.pendingProps, t.type.render, t.ref, Q);
				break;
			case 5: So(t);
			default: Fc(n, t), t = Z = ni(t, Vl), t = Ec(n, t, Vl);
		}
		e.memoizedProps = e.pendingProps, t === null ? Nu(e) : Z = t;
	}
	function Mu(e, t, n, r) {
		Ri = Li = null, So(t), Ca = null, wa = 0;
		var i = t.return;
		try {
			if (Ys(e, i, t, n, Q)) {
				Hl = 1, Ws(e, li(n, e.current)), Z = null;
				return;
			}
		} catch (t) {
			if (i !== null) throw Z = i, t;
			Hl = 1, Ws(e, li(n, e.current)), Z = null;
			return;
		}
		t.flags & 32768 ? (J || r === 1 ? e = !0 : zl || Q & 536870912 ? e = !1 : (Rl = e = !0, (r === 2 || r === 9 || r === 3 || r === 6) && (r = Ja.current, r !== null && r.tag === 13 && (r.flags |= 16384))), Pu(t, e)) : Nu(t);
	}
	function Nu(e) {
		var t = e;
		do {
			if (t.flags & 32768) {
				Pu(t, Rl);
				return;
			}
			e = t.return;
			var n = Nc(t.alternate, t, Vl);
			if (n !== null) {
				Z = n;
				return;
			}
			if (t = t.sibling, t !== null) {
				Z = t;
				return;
			}
			Z = t = e;
		} while (t !== null);
		Hl === 0 && (Hl = 5);
	}
	function Pu(e, t) {
		do {
			var n = Pc(e.alternate, e);
			if (n !== null) {
				n.flags &= 32767, Z = n;
				return;
			}
			if (n = e.return, n !== null && (n.flags |= 32768, n.subtreeFlags = 0, n.deletions = null), !t && (e = e.sibling, e !== null)) {
				Z = e;
				return;
			}
			Z = e = n;
		} while (e !== null);
		Hl = 6, Z = null;
	}
	function Fu(e, t, n, r, a, o, s, c, l) {
		e.cancelPendingCommit = null;
		do
			Bu();
		while (nu !== 0);
		if (X & 6) throw Error(i(327));
		if (t !== null) {
			if (t === e.current) throw Error(i(177));
			if (o = t.lanes | t.childLanes, o |= Wr, Ke(e, n, o, s, c, l), e === Fl && (Z = Fl = null, Q = 0), iu = t, ru = e, au = n, ou = o, su = a, cu = r, t.subtreeFlags & 10256 || t.flags & 10256 ? (e.callbackNode = null, e.callbackPriority = 0, Yu(Te, function() {
				return Vu(), null;
			})) : (e.callbackNode = null, e.callbackPriority = 0), r = (t.flags & 13878) != 0, t.subtreeFlags & 13878 || r) {
				r = I.T, I.T = null, a = L.p, L.p = 2, s = X, X |= 4;
				try {
					el(e, t, n);
				} finally {
					X = s, L.p = a, I.T = r;
				}
			}
			nu = 1, Iu(), Lu(), Ru();
		}
	}
	function Iu() {
		if (nu === 1) {
			nu = 0;
			var e = ru, t = iu, n = (t.flags & 13878) != 0;
			if (t.subtreeFlags & 13878 || n) {
				n = I.T, I.T = null;
				var r = L.p;
				L.p = 2;
				var i = X;
				X |= 4;
				try {
					pl(t, e);
					var a = zd, o = br(e.containerInfo), s = a.focusedElem, c = a.selectionRange;
					if (o !== s && s && s.ownerDocument && yr(s.ownerDocument.documentElement, s)) {
						if (c !== null && xr(s)) {
							var l = c.start, u = c.end;
							if (u === void 0 && (u = l), "selectionStart" in s) s.selectionStart = l, s.selectionEnd = Math.min(u, s.value.length);
							else {
								var d = s.ownerDocument || document, f = d && d.defaultView || window;
								if (f.getSelection) {
									var p = f.getSelection(), m = s.textContent.length, h = Math.min(c.start, m), g = c.end === void 0 ? h : Math.min(c.end, m);
									!p.extend && h > g && (o = g, g = h, h = o);
									var _ = vr(s, h), v = vr(s, g);
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
					X = i, L.p = r, I.T = n;
				}
			}
			e.current = t, nu = 2;
		}
	}
	function Lu() {
		if (nu === 2) {
			nu = 0;
			var e = ru, t = iu, n = (t.flags & 8772) != 0;
			if (t.subtreeFlags & 8772 || n) {
				n = I.T, I.T = null;
				var r = L.p;
				L.p = 2;
				var i = X;
				X |= 4;
				try {
					tl(e, t.alternate, t);
				} finally {
					X = i, L.p = r, I.T = n;
				}
			}
			nu = 3;
		}
	}
	function Ru() {
		if (nu === 4 || nu === 3) {
			nu = 0, xe();
			var e = ru, t = iu, n = au, r = cu;
			t.subtreeFlags & 10256 || t.flags & 10256 ? nu = 5 : (nu = 0, iu = ru = null, zu(e, e.pendingLanes));
			var i = e.pendingLanes;
			if (i === 0 && (tu = null), Ze(n), t = t.stateNode, je && typeof je.onCommitFiberRoot == "function") try {
				je.onCommitFiberRoot(Ae, t, void 0, (t.current.flags & 128) == 128);
			} catch {}
			if (r !== null) {
				t = I.T, i = L.p, L.p = 2, I.T = null;
				try {
					for (var a = e.onRecoverableError, o = 0; o < r.length; o++) {
						var s = r[o];
						a(s.value, { componentStack: s.stack });
					}
				} finally {
					I.T = t, L.p = i;
				}
			}
			au & 3 && Bu(), nd(e), i = e.pendingLanes, n & 261930 && i & 42 ? e === uu ? lu++ : (lu = 0, uu = e) : lu = 0, rd(0, !1);
		}
	}
	function zu(e, t) {
		(e.pooledCacheLanes &= t) === 0 && (t = e.pooledCache, t != null && (e.pooledCache = null, ea(t)));
	}
	function Bu() {
		return Iu(), Lu(), Ru(), Vu();
	}
	function Vu() {
		if (nu !== 5) return !1;
		var e = ru, t = ou;
		ou = 0;
		var n = Ze(au), r = I.T, a = L.p;
		try {
			L.p = 32 > n ? 32 : n, I.T = null, n = su, su = null;
			var o = ru, s = au;
			if (nu = 0, iu = ru = null, au = 0, X & 6) throw Error(i(331));
			var c = X;
			if (X |= 4, Al(o.current), Sl(o, o.current, s, n), X = c, rd(0, !1), je && typeof je.onPostCommitFiberRoot == "function") try {
				je.onPostCommitFiberRoot(Ae, o);
			} catch {}
			return !0;
		} finally {
			L.p = a, I.T = r, zu(e, t);
		}
	}
	function Hu(e, t, n) {
		t = li(n, t), t = Ks(e.stateNode, t, 2), e = Fa(e, t, 2), e !== null && (Ge(e, 2), nd(e));
	}
	function Uu(e, t, n) {
		if (e.tag === 3) Hu(e, e, n);
		else for (; t !== null;) {
			if (t.tag === 3) {
				Hu(t, e, n);
				break;
			} else if (t.tag === 1) {
				var r = t.stateNode;
				if (typeof t.type.getDerivedStateFromError == "function" || typeof r.componentDidCatch == "function" && (tu === null || !tu.has(r))) {
					e = li(n, e), n = qs(2), r = Fa(t, n, 2), r !== null && (Js(n, r, t, e), Ge(r, 2), nd(r));
					break;
				}
			}
			t = t.return;
		}
	}
	function Wu(e, t, n) {
		var r = e.pingCache;
		if (r === null) {
			r = e.pingCache = new Pl();
			var i = /* @__PURE__ */ new Set();
			r.set(t, i);
		} else i = r.get(t), i === void 0 && (i = /* @__PURE__ */ new Set(), r.set(t, i));
		i.has(n) || (Bl = !0, i.add(n), e = Gu.bind(null, e, t, n), t.then(e, e));
	}
	function Gu(e, t, n) {
		var r = e.pingCache;
		r !== null && r.delete(t), e.pingedLanes |= e.suspendedLanes & n, e.warmLanes &= ~n, Fl === e && (Q & n) === n && (Hl === 4 || Hl === 3 && (Q & 62914560) === Q && 300 > H() - Zl ? !(X & 2) && bu(e, 0) : Gl |= n, ql === Q && (ql = 0)), nd(e);
	}
	function Ku(e, t) {
		t === 0 && (t = Ue()), e = Jr(e, t), e !== null && (Ge(e, t), nd(e));
	}
	function qu(e) {
		var t = e.memoizedState, n = 0;
		t !== null && (n = t.retryLane), Ku(e, n);
	}
	function Ju(e, t) {
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
		r !== null && r.delete(t), Ku(e, n);
	}
	function Yu(e, t) {
		return ve(e, t);
	}
	var Xu = null, Zu = null, Qu = !1, $u = !1, ed = !1, td = 0;
	function nd(e) {
		e !== Zu && e.next === null && (Zu === null ? Xu = Zu = e : Zu = Zu.next = e), $u = !0, Qu || (Qu = !0, ld());
	}
	function rd(e, t) {
		if (!ed && $u) {
			ed = !0;
			do
				for (var n = !1, r = Xu; r !== null;) {
					if (!t) if (e !== 0) {
						var i = r.pendingLanes;
						if (i === 0) var a = 0;
						else {
							var o = r.suspendedLanes, s = r.pingedLanes;
							a = (1 << 31 - U(42 | e) + 1) - 1, a &= i & ~(o & ~s), a = a & 201326741 ? a & 201326741 | 1 : a ? a | 2 : 0;
						}
						a !== 0 && (n = !0, cd(r, a));
					} else a = Q, a = Be(r, r === Fl ? a : 0, r.cancelPendingCommit !== null || r.timeoutHandle !== -1), !(a & 3) || Ve(r, a) || (n = !0, cd(r, a));
					r = r.next;
				}
			while (n);
			ed = !1;
		}
	}
	function id() {
		ad();
	}
	function ad() {
		$u = Qu = !1;
		var e = 0;
		td !== 0 && Gd() && (e = td);
		for (var t = H(), n = null, r = Xu; r !== null;) {
			var i = r.next, a = od(r, t);
			a === 0 ? (r.next = null, n === null ? Xu = i : n.next = i, i === null && (Zu = n)) : (n = r, (e !== 0 || a & 3) && ($u = !0)), r = i;
		}
		nu !== 0 && nu !== 5 || rd(e, !1), td !== 0 && (td = 0);
	}
	function od(e, t) {
		for (var n = e.suspendedLanes, r = e.pingedLanes, i = e.expirationTimes, a = e.pendingLanes & -62914561; 0 < a;) {
			var o = 31 - U(a), s = 1 << o, c = i[o];
			c === -1 ? ((s & n) === 0 || (s & r) !== 0) && (i[o] = He(s, t)) : c <= t && (e.expiredLanes |= s), a &= ~s;
		}
		if (t = Fl, n = Q, n = Be(e, e === t ? n : 0, e.cancelPendingCommit !== null || e.timeoutHandle !== -1), r = e.callbackNode, n === 0 || e === t && (Il === 2 || Il === 9) || e.cancelPendingCommit !== null) return r !== null && r !== null && ye(r), e.callbackNode = null, e.callbackPriority = 0;
		if (!(n & 3) || Ve(e, n)) {
			if (t = n & -n, t === e.callbackPriority) return t;
			switch (r !== null && ye(r), Ze(n)) {
				case 2:
				case 8:
					n = we;
					break;
				case 32:
					n = Te;
					break;
				case 268435456:
					n = De;
					break;
				default: n = Te;
			}
			return r = sd.bind(null, e), n = ve(n, r), e.callbackPriority = t, e.callbackNode = n, t;
		}
		return r !== null && r !== null && ye(r), e.callbackPriority = 2, e.callbackNode = null, 2;
	}
	function sd(e, t) {
		if (nu !== 0 && nu !== 5) return e.callbackNode = null, e.callbackPriority = 0, null;
		var n = e.callbackNode;
		if (Bu() && e.callbackNode !== n) return null;
		var r = Q;
		return r = Be(e, e === Fl ? r : 0, e.cancelPendingCommit !== null || e.timeoutHandle !== -1), r === 0 ? null : (mu(e, r, t), od(e, H()), e.callbackNode != null && e.callbackNode === n ? sd.bind(null, e) : null);
	}
	function cd(e, t) {
		if (Bu()) return null;
		mu(e, t, !0);
	}
	function ld() {
		Yd(function() {
			X & 6 ? ve(Ce, id) : ad();
		});
	}
	function ud() {
		if (td === 0) {
			var e = ra;
			e === 0 && (e = Ie, Ie <<= 1, !(Ie & 261888) && (Ie = 256)), td = e;
		}
		return td;
	}
	function dd(e) {
		return e == null || typeof e == "symbol" || typeof e == "boolean" ? null : typeof e == "function" ? e : Gt("" + e);
	}
	function fd(e, t) {
		var n = t.ownerDocument.createElement("input");
		return n.name = t.name, n.value = t.value, e.id && n.setAttribute("form", e.id), t.parentNode.insertBefore(n, t), e = new FormData(e), n.parentNode.removeChild(n), e;
	}
	function pd(e, t, n, r, i) {
		if (t === "submit" && n && n.stateNode === i) {
			var a = dd((i[nt] || null).action), o = r.submitter;
			o && (t = (t = o[nt] || null) ? dd(t.formAction) : o.getAttribute("formAction"), t !== null && (a = t, o = null));
			var s = new mn("action", "action", null, r, i);
			e.push({
				event: s,
				listeners: [{
					instance: null,
					listener: function() {
						if (r.defaultPrevented) {
							if (td !== 0) {
								var e = o ? fd(i, o) : new FormData(i);
								vs(n, {
									pending: !0,
									data: e,
									method: i.method,
									action: a
								}, null, e);
							}
						} else typeof a == "function" && (s.preventDefault(), e = o ? fd(i, o) : new FormData(i), vs(n, {
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
	for (var md = 0; md < zr.length; md++) {
		var hd = zr[md];
		Br(hd.toLowerCase(), "on" + (hd[0].toUpperCase() + hd.slice(1)));
	}
	Br(Mr, "onAnimationEnd"), Br(Nr, "onAnimationIteration"), Br(Pr, "onAnimationStart"), Br("dblclick", "onDoubleClick"), Br("focusin", "onFocus"), Br("focusout", "onBlur"), Br(Fr, "onTransitionRun"), Br(q, "onTransitionStart"), Br(Ir, "onTransitionCancel"), Br(Lr, "onTransitionEnd"), gt("onMouseEnter", ["mouseout", "mouseover"]), gt("onMouseLeave", ["mouseout", "mouseover"]), gt("onPointerEnter", ["pointerout", "pointerover"]), gt("onPointerLeave", ["pointerout", "pointerover"]), ht("onChange", "change click focusin focusout input keydown keyup selectionchange".split(" ")), ht("onSelect", "focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(" ")), ht("onBeforeInput", [
		"compositionend",
		"keypress",
		"textInput",
		"paste"
	]), ht("onCompositionEnd", "compositionend focusout keydown keypress keyup mousedown".split(" ")), ht("onCompositionStart", "compositionstart focusout keydown keypress keyup mousedown".split(" ")), ht("onCompositionUpdate", "compositionupdate focusout keydown keypress keyup mousedown".split(" "));
	var gd = "abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(" "), _d = new Set("beforetoggle cancel close invalid load scroll scrollend toggle".split(" ").concat(gd));
	function vd(e, t) {
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
						Vr(e);
					}
					i.currentTarget = null, a = c;
				}
				else for (o = 0; o < r.length; o++) {
					if (s = r[o], c = s.instance, l = s.currentTarget, s = s.listener, c !== a && i.isPropagationStopped()) break a;
					a = s, i.currentTarget = l;
					try {
						a(i);
					} catch (e) {
						Vr(e);
					}
					i.currentTarget = null, a = c;
				}
			}
		}
	}
	function $(e, t) {
		var n = t[W];
		n === void 0 && (n = t[W] = /* @__PURE__ */ new Set());
		var r = e + "__bubble";
		n.has(r) || (Sd(t, e, 2, !1), n.add(r));
	}
	function yd(e, t, n) {
		var r = 0;
		t && (r |= 4), Sd(n, e, r, t);
	}
	var bd = "_reactListening" + Math.random().toString(36).slice(2);
	function xd(e) {
		if (!e[bd]) {
			e[bd] = !0, pt.forEach(function(t) {
				t !== "selectionchange" && (_d.has(t) || yd(t, !1, e), yd(t, !0, e));
			});
			var t = e.nodeType === 9 ? e : e.ownerDocument;
			t === null || t[bd] || (t[bd] = !0, yd("selectionchange", !1, t));
		}
	}
	function Sd(e, t, n, r) {
		switch (mp(t)) {
			case 2:
				var i = cp;
				break;
			case 8:
				i = lp;
				break;
			default: i = up;
		}
		n = i.bind(null, t, n, e), i = void 0, !nn || t !== "touchstart" && t !== "touchmove" && t !== "wheel" || (i = !0), r ? i === void 0 ? e.addEventListener(t, n, !0) : e.addEventListener(t, n, {
			capture: !0,
			passive: i
		}) : i === void 0 ? e.addEventListener(t, n, !1) : e.addEventListener(t, n, { passive: i });
	}
	function Cd(e, t, n, r, i) {
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
					if (s = ct(c), s === null) return;
					if (l = s.tag, l === 5 || l === 6 || l === 26 || l === 27) {
						r = a = s;
						continue a;
					}
					c = c.parentNode;
				}
			}
			r = r.return;
		}
		$t(function() {
			var r = a, i = Jt(n), s = [];
			a: {
				var c = Rr.get(e);
				if (c !== void 0) {
					var l = mn, u = e;
					switch (e) {
						case "keypress": if (ln(n) === 0) break a;
						case "keydown":
						case "keyup":
							l = Mn;
							break;
						case "focusin":
							u = "focus", l = Cn;
							break;
						case "focusout":
							u = "blur", l = Cn;
							break;
						case "beforeblur":
						case "afterblur":
							l = Cn;
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
							l = xn;
							break;
						case "drag":
						case "dragend":
						case "dragenter":
						case "dragexit":
						case "dragleave":
						case "dragover":
						case "dragstart":
						case "drop":
							l = Sn;
							break;
						case "touchcancel":
						case "touchend":
						case "touchmove":
						case "touchstart":
							l = Pn;
							break;
						case Mr:
						case Nr:
						case Pr:
							l = wn;
							break;
						case Lr:
							l = Fn;
							break;
						case "scroll":
						case "scrollend":
							l = gn;
							break;
						case "wheel":
							l = In;
							break;
						case "copy":
						case "cut":
						case "paste":
							l = Tn;
							break;
						case "gotpointercapture":
						case "lostpointercapture":
						case "pointercancel":
						case "pointerdown":
						case "pointermove":
						case "pointerout":
						case "pointerover":
						case "pointerup":
							l = Nn;
							break;
						case "toggle":
						case "beforetoggle": l = Ln;
					}
					var d = (t & 4) != 0, f = !d && (e === "scroll" || e === "scrollend"), p = d ? c === null ? null : c + "Capture" : c;
					d = [];
					for (var m = r, h; m !== null;) {
						var g = m;
						if (h = g.stateNode, g = g.tag, g !== 5 && g !== 26 && g !== 27 || h === null || p === null || (g = en(m, p), g != null && d.push(wd(m, g, h))), f) break;
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
					if (c = e === "mouseover" || e === "pointerover", l = e === "mouseout" || e === "pointerout", c && n !== qt && (u = n.relatedTarget || n.fromElement) && (ct(u) || u[rt])) break a;
					if ((l || c) && (c = i.window === i ? i : (c = i.ownerDocument) ? c.defaultView || c.parentWindow : window, l ? (u = n.relatedTarget || n.toElement, l = r, u = u ? ct(u) : null, u !== null && (f = o(u), d = u.tag, u !== f || d !== 5 && d !== 27 && d !== 6) && (u = null)) : (l = null, u = r), l !== u)) {
						if (d = xn, g = "onMouseLeave", p = "onMouseEnter", m = "mouse", (e === "pointerout" || e === "pointerover") && (d = Nn, g = "onPointerLeave", p = "onPointerEnter", m = "pointer"), f = l == null ? c : ut(l), h = u == null ? c : ut(u), c = new d(g, m + "leave", l, n, i), c.target = f, c.relatedTarget = h, g = null, ct(i) === r && (d = new d(p, m + "enter", u, n, i), d.target = h, d.relatedTarget = f, g = d), f = g, l && u) b: {
							for (d = Ed, p = l, m = u, h = 0, g = p; g; g = d(g)) h++;
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
						l !== null && Dd(s, c, l, d, !1), u !== null && f !== null && Dd(s, f, u, d, !0);
					}
				}
				a: {
					if (c = r ? ut(r) : window, l = c.nodeName && c.nodeName.toLowerCase(), l === "select" || l === "input" && c.type === "file") var v = rr;
					else if (Zn(c)) if (ir) v = pr;
					else {
						v = dr;
						var y = ur;
					}
					else l = c.nodeName, !l || l.toLowerCase() !== "input" || c.type !== "checkbox" && c.type !== "radio" ? r && Ht(r.elementType) && (v = rr) : v = fr;
					if (v &&= v(e, r)) {
						Qn(s, v, n, i);
						break a;
					}
					y && y(e, c, r), e === "focusout" && r && c.type === "number" && r.memoizedProps.value != null && Pt(c, "number", c.value);
				}
				switch (y = r ? ut(r) : window, e) {
					case "focusin":
						(Zn(y) || y.contentEditable === "true") && (Cr = y, wr = r, Tr = null);
						break;
					case "focusout":
						Tr = wr = Cr = null;
						break;
					case "mousedown":
						Er = !0;
						break;
					case "contextmenu":
					case "mouseup":
					case "dragend":
						Er = !1, Dr(s, n, i);
						break;
					case "selectionchange": if (Sr) break;
					case "keydown":
					case "keyup": Dr(s, n, i);
				}
				var b;
				if (zn) b: {
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
				else qn ? Gn(e, n) && (x = "onCompositionEnd") : e === "keydown" && n.keyCode === 229 && (x = "onCompositionStart");
				x && (Hn && n.locale !== "ko" && (qn || x !== "onCompositionStart" ? x === "onCompositionEnd" && qn && (b = cn()) : (an = i, on = "value" in an ? an.value : an.textContent, qn = !0)), y = Td(r, x), 0 < y.length && (x = new En(x, e, null, n, i), s.push({
					event: x,
					listeners: y
				}), b ? x.data = b : (b = Kn(n), b !== null && (x.data = b)))), (b = Vn ? Jn(e, n) : Yn(e, n)) && (x = Td(r, "onBeforeInput"), 0 < x.length && (y = new En("onBeforeInput", "beforeinput", null, n, i), s.push({
					event: y,
					listeners: x
				}), y.data = b)), pd(s, e, r, n, i);
			}
			vd(s, t);
		});
	}
	function wd(e, t, n) {
		return {
			instance: e,
			listener: t,
			currentTarget: n
		};
	}
	function Td(e, t) {
		for (var n = t + "Capture", r = []; e !== null;) {
			var i = e, a = i.stateNode;
			if (i = i.tag, i !== 5 && i !== 26 && i !== 27 || a === null || (i = en(e, n), i != null && r.unshift(wd(e, i, a)), i = en(e, t), i != null && r.push(wd(e, i, a))), e.tag === 3) return r;
			e = e.return;
		}
		return [];
	}
	function Ed(e) {
		if (e === null) return null;
		do
			e = e.return;
		while (e && e.tag !== 5 && e.tag !== 27);
		return e || null;
	}
	function Dd(e, t, n, r, i) {
		for (var a = t._reactName, o = []; n !== null && n !== r;) {
			var s = n, c = s.alternate, l = s.stateNode;
			if (s = s.tag, c !== null && c === r) break;
			s !== 5 && s !== 26 && s !== 27 || l === null || (c = l, i ? (l = en(n, a), l != null && o.unshift(wd(n, l, c))) : i || (l = en(n, a), l != null && o.push(wd(n, l, c)))), n = n.return;
		}
		o.length !== 0 && e.push({
			event: t,
			listeners: o
		});
	}
	var Od = /\r\n?/g, kd = /\u0000|\uFFFD/g;
	function Ad(e) {
		return (typeof e == "string" ? e : "" + e).replace(Od, "\n").replace(kd, "");
	}
	function jd(e, t) {
		return t = Ad(t), Ad(e) === t;
	}
	function Md(e, t, n, r, a, o) {
		switch (n) {
			case "children":
				typeof r == "string" ? t === "body" || t === "textarea" && r === "" || Rt(e, r) : (typeof r == "number" || typeof r == "bigint") && t !== "body" && Rt(e, "" + r);
				break;
			case "className":
				St(e, "class", r);
				break;
			case "tabIndex":
				St(e, "tabindex", r);
				break;
			case "dir":
			case "role":
			case "viewBox":
			case "width":
			case "height":
				St(e, n, r);
				break;
			case "style":
				Vt(e, r, o);
				break;
			case "data": if (t !== "object") {
				St(e, "data", r);
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
				r = Gt("" + r), e.setAttribute(n, r);
				break;
			case "action":
			case "formAction":
				if (typeof r == "function") {
					e.setAttribute(n, "javascript:throw new Error('A React form was unexpectedly submitted. If you called form.submit() manually, consider using form.requestSubmit() instead. If you\\'re trying to use event.stopPropagation() in a submit event handler, consider also calling event.preventDefault().')");
					break;
				} else typeof o == "function" && (n === "formAction" ? (t !== "input" && Md(e, t, "name", a.name, a, null), Md(e, t, "formEncType", a.formEncType, a, null), Md(e, t, "formMethod", a.formMethod, a, null), Md(e, t, "formTarget", a.formTarget, a, null)) : (Md(e, t, "encType", a.encType, a, null), Md(e, t, "method", a.method, a, null), Md(e, t, "target", a.target, a, null)));
				if (r == null || typeof r == "symbol" || typeof r == "boolean") {
					e.removeAttribute(n);
					break;
				}
				r = Gt("" + r), e.setAttribute(n, r);
				break;
			case "onClick":
				r != null && (e.onclick = Kt);
				break;
			case "onScroll":
				r != null && $("scroll", e);
				break;
			case "onScrollEnd":
				r != null && $("scrollend", e);
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
				n = Gt("" + r), e.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", n);
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
				$("beforetoggle", e), $("toggle", e), xt(e, "popover", r);
				break;
			case "xlinkActuate":
				Ct(e, "http://www.w3.org/1999/xlink", "xlink:actuate", r);
				break;
			case "xlinkArcrole":
				Ct(e, "http://www.w3.org/1999/xlink", "xlink:arcrole", r);
				break;
			case "xlinkRole":
				Ct(e, "http://www.w3.org/1999/xlink", "xlink:role", r);
				break;
			case "xlinkShow":
				Ct(e, "http://www.w3.org/1999/xlink", "xlink:show", r);
				break;
			case "xlinkTitle":
				Ct(e, "http://www.w3.org/1999/xlink", "xlink:title", r);
				break;
			case "xlinkType":
				Ct(e, "http://www.w3.org/1999/xlink", "xlink:type", r);
				break;
			case "xmlBase":
				Ct(e, "http://www.w3.org/XML/1998/namespace", "xml:base", r);
				break;
			case "xmlLang":
				Ct(e, "http://www.w3.org/XML/1998/namespace", "xml:lang", r);
				break;
			case "xmlSpace":
				Ct(e, "http://www.w3.org/XML/1998/namespace", "xml:space", r);
				break;
			case "is":
				xt(e, "is", r);
				break;
			case "innerText":
			case "textContent": break;
			default: (!(2 < n.length) || n[0] !== "o" && n[0] !== "O" || n[1] !== "n" && n[1] !== "N") && (n = Ut.get(n) || n, xt(e, n, r));
		}
	}
	function Nd(e, t, n, r, a, o) {
		switch (n) {
			case "style":
				Vt(e, r, o);
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
				typeof r == "string" ? Rt(e, r) : (typeof r == "number" || typeof r == "bigint") && Rt(e, "" + r);
				break;
			case "onScroll":
				r != null && $("scroll", e);
				break;
			case "onScrollEnd":
				r != null && $("scrollend", e);
				break;
			case "onClick":
				r != null && (e.onclick = Kt);
				break;
			case "suppressContentEditableWarning":
			case "suppressHydrationWarning":
			case "innerHTML":
			case "ref": break;
			case "innerText":
			case "textContent": break;
			default: if (!mt.hasOwnProperty(n)) a: {
				if (n[0] === "o" && n[1] === "n" && (a = n.endsWith("Capture"), t = n.slice(2, a ? n.length - 7 : void 0), o = e[nt] || null, o = o == null ? null : o[n], typeof o == "function" && e.removeEventListener(t, o, a), typeof r == "function")) {
					typeof o != "function" && o !== null && (n in e ? e[n] = null : e.hasAttribute(n) && e.removeAttribute(n)), e.addEventListener(t, r, a);
					break a;
				}
				n in e ? e[n] = r : !0 === r ? e.setAttribute(n, "") : xt(e, n, r);
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
				$("error", e), $("load", e);
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
						default: Md(e, t, o, s, n, null);
					}
				}
				a && Md(e, t, "srcSet", n.srcSet, n, null), r && Md(e, t, "src", n.src, n, null);
				return;
			case "input":
				$("invalid", e);
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
						default: Md(e, t, r, d, n, null);
					}
				}
				Nt(e, o, c, l, u, s, a, !1);
				return;
			case "select":
				for (a in $("invalid", e), r = s = o = null, n) if (n.hasOwnProperty(a) && (c = n[a], c != null)) switch (a) {
					case "value":
						o = c;
						break;
					case "defaultValue":
						s = c;
						break;
					case "multiple": r = c;
					default: Md(e, t, a, c, n, null);
				}
				t = o, n = s, e.multiple = !!r, t == null ? n != null && Ft(e, !!r, n, !0) : Ft(e, !!r, t, !1);
				return;
			case "textarea":
				for (s in $("invalid", e), o = a = r = null, n) if (n.hasOwnProperty(s) && (c = n[s], c != null)) switch (s) {
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
					default: Md(e, t, s, c, n, null);
				}
				Lt(e, r, a, o);
				return;
			case "option":
				for (l in n) if (n.hasOwnProperty(l) && (r = n[l], r != null)) switch (l) {
					case "selected":
						e.selected = r && typeof r != "function" && typeof r != "symbol";
						break;
					default: Md(e, t, l, r, n, null);
				}
				return;
			case "dialog":
				$("beforetoggle", e), $("toggle", e), $("cancel", e), $("close", e);
				break;
			case "iframe":
			case "object":
				$("load", e);
				break;
			case "video":
			case "audio":
				for (r = 0; r < gd.length; r++) $(gd[r], e);
				break;
			case "image":
				$("error", e), $("load", e);
				break;
			case "details":
				$("toggle", e);
				break;
			case "embed":
			case "source":
			case "link": $("error", e), $("load", e);
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
					default: Md(e, t, u, r, n, null);
				}
				return;
			default: if (Ht(t)) {
				for (d in n) n.hasOwnProperty(d) && (r = n[d], r !== void 0 && Nd(e, t, d, r, n, void 0));
				return;
			}
		}
		for (c in n) n.hasOwnProperty(c) && (r = n[c], r != null && Md(e, t, c, r, n, null));
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
						default: r.hasOwnProperty(m) || Md(e, t, m, null, r, f);
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
						default: m !== f && Md(e, t, p, m, r, f);
					}
				}
				Mt(e, s, c, l, u, d, o, a);
				return;
			case "select":
				for (o in m = s = c = p = null, n) if (l = n[o], n.hasOwnProperty(o) && l != null) switch (o) {
					case "value": break;
					case "multiple": m = l;
					default: r.hasOwnProperty(o) || Md(e, t, o, null, r, l);
				}
				for (a in r) if (o = r[a], l = n[a], r.hasOwnProperty(a) && (o != null || l != null)) switch (a) {
					case "value":
						p = o;
						break;
					case "defaultValue":
						c = o;
						break;
					case "multiple": s = o;
					default: o !== l && Md(e, t, a, o, r, l);
				}
				t = c, n = s, r = m, p == null ? !!r != !!n && (t == null ? Ft(e, !!n, n ? [] : "", !1) : Ft(e, !!n, t, !0)) : Ft(e, !!n, p, !1);
				return;
			case "textarea":
				for (c in m = p = null, n) if (a = n[c], n.hasOwnProperty(c) && a != null && !r.hasOwnProperty(c)) switch (c) {
					case "value": break;
					case "children": break;
					default: Md(e, t, c, null, r, a);
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
					default: a !== o && Md(e, t, s, a, r, o);
				}
				It(e, p, m);
				return;
			case "option":
				for (var h in n) if (p = n[h], n.hasOwnProperty(h) && p != null && !r.hasOwnProperty(h)) switch (h) {
					case "selected":
						e.selected = !1;
						break;
					default: Md(e, t, h, null, r, p);
				}
				for (l in r) if (p = r[l], m = n[l], r.hasOwnProperty(l) && p !== m && (p != null || m != null)) switch (l) {
					case "selected":
						e.selected = p && typeof p != "function" && typeof p != "symbol";
						break;
					default: Md(e, t, l, p, r, m);
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
				for (var g in n) p = n[g], n.hasOwnProperty(g) && p != null && !r.hasOwnProperty(g) && Md(e, t, g, null, r, p);
				for (u in r) if (p = r[u], m = n[u], r.hasOwnProperty(u) && p !== m && (p != null || m != null)) switch (u) {
					case "children":
					case "dangerouslySetInnerHTML":
						if (p != null) throw Error(i(137, t));
						break;
					default: Md(e, t, u, p, r, m);
				}
				return;
			default: if (Ht(t)) {
				for (var _ in n) p = n[_], n.hasOwnProperty(_) && p !== void 0 && !r.hasOwnProperty(_) && Nd(e, t, _, void 0, r, p);
				for (d in r) p = r[d], m = n[d], !r.hasOwnProperty(d) || p === m || p === void 0 && m === void 0 || Nd(e, t, d, p, r, m);
				return;
			}
		}
		for (var v in n) p = n[v], n.hasOwnProperty(v) && p != null && !r.hasOwnProperty(v) && Md(e, t, v, null, r, p);
		for (f in r) p = r[f], m = n[f], !r.hasOwnProperty(f) || p === m || p == null && m == null || Md(e, t, f, p, r, m);
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
					a[ot] || s === "SCRIPT" || s === "STYLE" || s === "LINK" && a.rel.toLowerCase() === "stylesheet" || n.removeChild(a), a = o;
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
					ef(n), st(n);
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
			else if (!e[ot]) switch (t) {
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
		st(e);
	}
	var mf = /* @__PURE__ */ new Map(), hf = /* @__PURE__ */ new Set();
	function gf(e) {
		return typeof e.getRootNode == "function" ? e.getRootNode() : e.nodeType === 9 ? e : e.ownerDocument;
	}
	var _f = L.d;
	L.d = {
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
		var e = _f.f(), t = vu();
		return e || t;
	}
	function yf(e) {
		var t = lt(e);
		t !== null && t.tag === 5 && t.type === "form" ? bs(t) : _f.r(e);
	}
	var bf = typeof document > "u" ? null : document;
	function xf(e, t, n) {
		var r = bf;
		if (r && typeof t == "string" && t) {
			var i = jt(t);
			i = "link[rel=\"" + e + "\"][href=\"" + i + "\"]", typeof n == "string" && (i += "[crossorigin=\"" + n + "\"]"), hf.has(i) || (hf.add(i), e = {
				rel: e,
				crossOrigin: n,
				href: t
			}, r.querySelector(i) === null && (t = r.createElement("link"), Pd(t, "link", e), ft(t), r.head.appendChild(t)));
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
			var i = "link[rel=\"preload\"][as=\"" + jt(t) + "\"]";
			t === "image" && n && n.imageSrcSet ? (i += "[imagesrcset=\"" + jt(n.imageSrcSet) + "\"]", typeof n.imageSizes == "string" && (i += "[imagesizes=\"" + jt(n.imageSizes) + "\"]")) : i += "[href=\"" + jt(e) + "\"]";
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
			}, n), mf.set(a, e), r.querySelector(i) !== null || t === "style" && r.querySelector(jf(a)) || t === "script" && r.querySelector(Ff(a)) || (t = r.createElement("link"), Pd(t, "link", e), ft(t), r.head.appendChild(t)));
		}
	}
	function Tf(e, t) {
		_f.m(e, t);
		var n = bf;
		if (n && e) {
			var r = t && typeof t.as == "string" ? t.as : "script", i = "link[rel=\"modulepreload\"][as=\"" + jt(r) + "\"][href=\"" + jt(e) + "\"]", a = i;
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
				r = n.createElement("link"), Pd(r, "link", e), ft(r), n.head.appendChild(r);
			}
		}
	}
	function Ef(e, t, n) {
		_f.S(e, t, n);
		var r = bf;
		if (r && e) {
			var i = dt(r).hoistableStyles, a = Af(e);
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
					ft(c), Pd(c, "link", e), c._p = new Promise(function(e, t) {
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
			var r = dt(n).hoistableScripts, i = Pf(e), a = r.get(i);
			a || (a = n.querySelector(Ff(i)), a || (e = h({
				src: e,
				async: !0
			}, t), (t = mf.get(i)) && zf(e, t), a = n.createElement("script"), ft(a), Pd(a, "link", e), n.head.appendChild(a)), a = {
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
			var r = dt(n).hoistableScripts, i = Pf(e), a = r.get(i);
			a || (a = n.querySelector(Ff(i)), a || (e = h({
				src: e,
				async: !0,
				type: "module"
			}, t), (t = mf.get(i)) && zf(e, t), a = n.createElement("script"), ft(a), Pd(a, "link", e), n.head.appendChild(a)), a = {
				type: "script",
				instance: a,
				count: 1,
				state: null
			}, r.set(i, a));
		}
	}
	function kf(e, t, n, r) {
		var a = (a = ie.current) ? gf(a) : null;
		if (!a) throw Error(i(446));
		switch (e) {
			case "meta":
			case "title": return null;
			case "style": return typeof n.precedence == "string" && typeof n.href == "string" ? (t = Af(n.href), n = dt(a).hoistableStyles, r = n.get(t), r || (r = {
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
					var o = dt(a).hoistableStyles, s = o.get(e);
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
			case "script": return t = n.async, n = n.src, typeof n == "string" && t && typeof t != "function" && typeof t != "symbol" ? (t = Pf(n), n = dt(a).hoistableScripts, r = n.get(t), r || (r = {
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
		return "href=\"" + jt(e) + "\"";
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
		}), Pd(t, "link", n), ft(t), e.head.appendChild(t));
	}
	function Pf(e) {
		return "[src=\"" + jt(e) + "\"]";
	}
	function Ff(e) {
		return "script[async]" + e;
	}
	function If(e, t, n) {
		if (t.count++, t.instance === null) switch (t.type) {
			case "style":
				var r = e.querySelector("style[data-href~=\"" + jt(n.href) + "\"]");
				if (r) return t.instance = r, ft(r), r;
				var a = h({}, n, {
					"data-href": n.href,
					"data-precedence": n.precedence,
					href: null,
					precedence: null
				});
				return r = (e.ownerDocument || e).createElement("style"), ft(r), Pd(r, "style", a), Lf(r, n.precedence, e), t.instance = r;
			case "stylesheet":
				a = Af(n.href);
				var o = e.querySelector(jf(a));
				if (o) return t.state.loading |= 4, t.instance = o, ft(o), o;
				r = Mf(n), (a = mf.get(a)) && Rf(r, a), o = (e.ownerDocument || e).createElement("link"), ft(o);
				var s = o;
				return s._p = new Promise(function(e, t) {
					s.onload = e, s.onerror = t;
				}), Pd(o, "link", r), t.state.loading |= 4, Lf(o, n.precedence, e), t.instance = o;
			case "script": return o = Pf(n.src), (a = e.querySelector(Ff(o))) ? (t.instance = a, ft(a), a) : (r = n, (a = mf.get(o)) && (r = h({}, n), zf(r, a)), e = e.ownerDocument || e, a = e.createElement("script"), ft(a), Pd(a, "link", r), e.head.appendChild(a), t.instance = a);
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
			if (!(a[ot] || a[tt] || e === "link" && a.getAttribute("rel") === "stylesheet") && a.namespaceURI !== "http://www.w3.org/2000/svg") {
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
					t = a._p, typeof t == "object" && t && typeof t.then == "function" && (e.count++, e = Jf.bind(e), t.then(e, e)), n.state.loading |= 4, n.instance = a, ft(a);
					return;
				}
				a = t.ownerDocument || t, r = Mf(r), (i = mf.get(i)) && Rf(r, i), a = a.createElement("link"), ft(a);
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
		_currentValue: R,
		_currentValue2: R,
		_threadCount: 0
	};
	function $f(e, t, n, r, i, a, o, s, c) {
		this.tag = 1, this.containerInfo = e, this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = -1, this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null, this.callbackPriority = 0, this.expirationTimes = We(-1), this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = We(0), this.hiddenUpdates = We(null), this.identifierPrefix = r, this.onUncaughtError = i, this.onCaughtError = a, this.onRecoverableError = o, this.pooledCache = null, this.pooledCacheLanes = 0, this.formState = c, this.incompleteTransitions = /* @__PURE__ */ new Map();
	}
	function ep(e, t, n, r, i, a, o, s, c, l, u, d) {
		return e = new $f(e, t, n, o, c, l, u, d, s), t = 1, !0 === a && (t |= 24), a = $r(3, null, null, t), e.current = a, a.stateNode = e, t = $i(), t.refCount++, e.pooledCache = t, t.refCount++, a.memoizedState = {
			element: r,
			isDehydrated: n,
			cache: t
		}, Ma(a), e;
	}
	function tp(e) {
		return e ? (e = Zr, e) : Zr;
	}
	function np(e, t, n, r, i, a) {
		i = tp(i), r.context === null ? r.context = i : r.pendingContext = i, r = Pa(t), r.payload = { element: n }, a = a === void 0 ? null : a, a !== null && (r.callback = a), n = Fa(e, r, t), n !== null && (pu(n, e, t), Ia(n, e, t));
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
			var t = Jr(e, 67108864);
			t !== null && pu(t, e, 67108864), ip(e, 67108864);
		}
	}
	function op(e) {
		if (e.tag === 13 || e.tag === 31) {
			var t = du();
			t = Xe(t);
			var n = Jr(e, t);
			n !== null && pu(n, e, t), ip(e, t);
		}
	}
	var sp = !0;
	function cp(e, t, n, r) {
		var i = I.T;
		I.T = null;
		var a = L.p;
		try {
			L.p = 2, up(e, t, n, r);
		} finally {
			L.p = a, I.T = i;
		}
	}
	function lp(e, t, n, r) {
		var i = I.T;
		I.T = null;
		var a = L.p;
		try {
			L.p = 8, up(e, t, n, r);
		} finally {
			L.p = a, I.T = i;
		}
	}
	function up(e, t, n, r) {
		if (sp) {
			var i = dp(r);
			if (i === null) Cd(e, t, r, fp, n), Cp(e, r);
			else if (Tp(i, e, t, n, r)) r.stopPropagation();
			else if (Cp(e, r), t & 4 && -1 < Sp.indexOf(e)) {
				for (; i !== null;) {
					var a = lt(i);
					if (a !== null) switch (a.tag) {
						case 3:
							if (a = a.stateNode, a.current.memoizedState.isDehydrated) {
								var o = ze(a.pendingLanes);
								if (o !== 0) {
									var s = a;
									for (s.pendingLanes |= 2, s.entangledLanes |= 2; o;) {
										var c = 1 << 31 - U(o);
										s.entanglements[1] |= c, o &= ~c;
									}
									nd(a), !(X & 6) && ($l = H() + 500, rd(0, !1));
								}
							}
							break;
						case 31:
						case 13: s = Jr(a, 2), s !== null && pu(s, a, 2), vu(), ip(a, 2);
					}
					if (a = dp(r), a === null && Cd(e, t, r, fp, n), a === i) break;
					i = a;
				}
				i !== null && r.stopPropagation();
			} else Cd(e, t, r, null, n);
		}
	}
	function dp(e) {
		return e = Jt(e), pp(e);
	}
	var fp = null;
	function pp(e) {
		if (fp = null, e = ct(e), e !== null) {
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
			case "message": switch (Se()) {
				case Ce: return 2;
				case we: return 8;
				case Te:
				case Ee: return 32;
				case De: return 268435456;
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
		}, t !== null && (t = lt(t), t !== null && ap(t)), e) : (e.eventSystemFlags |= r, t = e.targetContainers, i !== null && t.indexOf(i) === -1 && t.push(i), e);
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
		var t = ct(e.target);
		if (t !== null) {
			var n = o(t);
			if (n !== null) {
				if (t = n.tag, t === 13) {
					if (t = s(n), t !== null) {
						e.blockedOn = t, $e(e.priority, function() {
							op(n);
						});
						return;
					}
				} else if (t === 31) {
					if (t = c(n), t !== null) {
						e.blockedOn = t, $e(e.priority, function() {
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
				qt = r, n.target.dispatchEvent(r), qt = null;
			} else return t = lt(n), t !== null && ap(t), e.blockedOn = n, !1;
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
				var a = lt(n);
				a !== null && (e.splice(t, 3), t -= 3, vs(a, {
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
			var i = n[r], a = n[r + 1], o = i[nt] || null;
			if (typeof a == "function") o || Mp(n);
			else if (o) {
				var s = null;
				if (a && a.hasAttribute("formAction")) {
					if (i = a, o = a[nt] || null) s = o.formAction;
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
		np(n, du(), e, t, null, null);
	}, Ip.prototype.unmount = Fp.prototype.unmount = function() {
		var e = this._internalRoot;
		if (e !== null) {
			this._internalRoot = null;
			var t = e.containerInfo;
			np(e.current, 2, null, e, null, null), vu(), t[rt] = null;
		}
	};
	function Ip(e) {
		this._internalRoot = e;
	}
	Ip.prototype.unstable_scheduleHydration = function(e) {
		if (e) {
			var t = Qe();
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
	L.findDOMNode = function(e) {
		var t = e._reactInternals;
		if (t === void 0) throw typeof e.render == "function" ? Error(i(188)) : (e = Object.keys(e).join(","), Error(i(268, e)));
		return e = d(t), e = e === null ? null : p(e), e = e === null ? null : e.stateNode, e;
	};
	var Rp = {
		bundleType: 0,
		version: "19.2.7",
		rendererPackageName: "react-dom",
		currentDispatcherRef: I,
		reconcilerVersion: "19.2.7"
	};
	if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u") {
		var zp = __REACT_DEVTOOLS_GLOBAL_HOOK__;
		if (!zp.isDisabled && zp.supportsFiber) try {
			Ae = zp.inject(Rp), je = zp;
		} catch {}
	}
	e.createRoot = function(e, t) {
		if (!a(e)) throw Error(i(299));
		var n = !1, r = "", o = Vs, s = Hs, c = Us;
		return t != null && (!0 === t.unstable_strictMode && (n = !0), t.identifierPrefix !== void 0 && (r = t.identifierPrefix), t.onUncaughtError !== void 0 && (o = t.onUncaughtError), t.onCaughtError !== void 0 && (s = t.onCaughtError), t.onRecoverableError !== void 0 && (c = t.onRecoverableError)), t = ep(e, 1, !1, null, null, n, r, null, o, s, c, Pp), e[rt] = t.current, xd(e), new Fp(t);
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
		id: "contractsAgent",
		label: "סוכן חוזים"
	},
	{
		id: "scheduleAgent",
		label: "סוכן שיוך ללו״ז"
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
		id: "memory",
		label: "זיכרון"
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
function D(e, t, n) {
	let r = t.split("."), i = { ...e }, a = i;
	for (let e = 0; e < r.length - 1; e++) a[r[e]] = { ...a[r[e]] }, a = a[r[e]];
	return a[r[r.length - 1]] = n, i;
}
function O(e) {
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
		memory: e.memory ? JSON.parse(JSON.stringify(e.memory)) : {},
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
		presets: e.presets || [],
		scheduleAssignmentAgent: e.scheduleAssignmentAgent ? JSON.parse(JSON.stringify(e.scheduleAssignmentAgent)) : {},
		contractsAgent: e.contractsAgent ? JSON.parse(JSON.stringify(e.contractsAgent)) : {}
	} : {};
}
function k(e) {
	return {
		models: e.models,
		prompts: e.prompts,
		ai: e.ai,
		retrieval: e.retrieval,
		rag: e.rag,
		graph: e.graph,
		cache: e.cache,
		memory: e.memory,
		knowledge: {
			...e.knowledge,
			triggerKeywords: (e.knowledge?.triggerKeywords || "").split("\n").map((e) => e.trim()).filter(Boolean)
		},
		toolsRuntime: e.toolsRuntime,
		secrets: e.secrets,
		contentSource: e.contentSource,
		n8nBaseUrl: e.n8nBaseUrl,
		tools: Object.fromEntries(Object.entries(e.tools || {}).map(([e, t]) => [e, { url: t }])),
		timezone: e.timezone,
		scheduleAssignmentAgent: e.scheduleAssignmentAgent,
		contractsAgent: e.contractsAgent
	};
}
var A = ({ path: e, size: t = 16, ...n }) => /* @__PURE__ */ (0, x.jsx)("svg", {
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
}), j = {
	info: "M12 22C6.5 22 2 17.5 2 12S6.5 2 12 2s10 4.5 10 10-4.5 10-10 10zm0-11v5m0-8h.01",
	connections: "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
	agents: "M12 2a5 5 0 1 0 0 10A5 5 0 0 0 12 2zM3.5 22a8.5 8.5 0 0 1 17 0",
	contractsAgent: "M6 2h9l4 4v16H6zM14 2v5h5M9 12h7M9 16h7M9 8h2",
	scheduleAgent: "M4 5h16M7 3v4m10-4v4M5 9h14v11H5zM9 13l2 2 4-4",
	retrieval: "M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z",
	content: "M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7zm0 5h16M8 3v4M16 3v4",
	tools: "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3-3a1 1 0 0 0 0-1.4L19 3.3a1 1 0 0 0-1.4 0zM5 17l-1 4 4-1L20 8l-3-3zM16 5l3 3",
	presets: "M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2zM17 21v-8H7v8M7 3v5h8",
	performance: "M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm1.5-1.5L18 8M5 19a9 9 0 1 1 14 0",
	memory: "M9 3a3 3 0 0 0-3 3v1a3 3 0 0 0-2 5.2A3 3 0 0 0 6 17v1a3 3 0 0 0 5 2.2V3H9zm6 0a3 3 0 0 1 3 3v1a3 3 0 0 1 2 5.2A3 3 0 0 1 18 17v1a3 3 0 0 1-5 2.2V3h2z",
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
}, M = {
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
function N({ label: e, hint: t, info: n, children: r, wide: i }) {
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		style: {
			...i ? { gridColumn: "1 / -1" } : {},
			...M.label
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
				}), n && /* @__PURE__ */ (0, x.jsx)(P, {
					text: n,
					label: e
				})]
			}),
			r,
			t && /* @__PURE__ */ (0, x.jsx)("p", {
				style: M.hint,
				children: t
			})
		]
	});
}
function P({ text: e, label: t }) {
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
			children: /* @__PURE__ */ (0, x.jsx)(A, {
				path: j.info,
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
function F({ children: e }) {
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
		children: [/* @__PURE__ */ (0, x.jsx)(A, {
			path: j.info,
			size: 14,
			style: {
				flexShrink: 0,
				marginTop: 1,
				color: "var(--brand-500)"
			}
		}), /* @__PURE__ */ (0, x.jsx)("span", { children: e })]
	});
}
var I = "0 0 0 3px rgba(63, 141, 104, .16)";
function L({ value: e, onChange: t, type: n = "text", placeholder: r, min: i, max: a, step: o, style: s, name: c, autoComplete: l, spellCheck: u, autoCapitalize: d, ...f }) {
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
			...M.input,
			borderColor: p ? "var(--brand-500)" : void 0,
			boxShadow: p ? I : "none",
			...s
		}
	});
}
function R({ value: e, onChange: t, children: n, style: r }) {
	let [i, a] = (0, b.useState)(!1);
	return /* @__PURE__ */ (0, x.jsx)("select", {
		value: e ?? "",
		onChange: (e) => t(e.target.value),
		onFocus: () => a(!0),
		onBlur: () => a(!1),
		style: {
			...M.input,
			cursor: "pointer",
			borderColor: i ? "var(--brand-500)" : void 0,
			boxShadow: i ? I : "none",
			...r
		},
		children: n
	});
}
function z({ label: e, checked: t, onChange: n, info: r }) {
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
			children: [e, r && /* @__PURE__ */ (0, x.jsx)(P, {
				text: r,
				label: e
			})]
		})]
	});
}
function ee({ value: e, onChange: t, rows: n = 6, placeholder: r, dir: i, style: a, ...o }) {
	let [s, c] = (0, b.useState)(!1);
	return /* @__PURE__ */ (0, x.jsx)("textarea", {
		value: e ?? "",
		rows: n,
		placeholder: r,
		dir: i,
		onChange: (e) => t(e.target.value),
		onFocus: () => c(!0),
		onBlur: () => c(!1),
		spellCheck: !1,
		...o,
		style: {
			...M.input,
			resize: "vertical",
			lineHeight: 1.5,
			borderColor: s ? "var(--brand-500)" : void 0,
			boxShadow: s ? I : "none",
			...a
		}
	});
}
function te({ label: e, value: t, onChange: n, placeholder: r, hint: i, info: a, disabled: o = !1 }) {
	let [s, c] = (0, b.useState)(!1);
	return /* @__PURE__ */ (0, x.jsx)(N, {
		label: e,
		hint: i,
		info: a,
		children: /* @__PURE__ */ (0, x.jsxs)("div", {
			style: { position: "relative" },
			children: [/* @__PURE__ */ (0, x.jsx)(L, {
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
				children: /* @__PURE__ */ (0, x.jsx)(A, {
					path: s ? j.eyeOff : j.eye,
					size: 15
				})
			})]
		})
	});
}
function B({ title: e, children: t, defaultOpen: n = !1 }) {
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
			children: [e, /* @__PURE__ */ (0, x.jsx)(A, {
				path: j.chevronDown,
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
function V({ ok: e }) {
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
function ne({ value: e, onChange: t, models: n, includeEmbedding: r = !1 }) {
	let i = !e || n.some((t) => t.id === e);
	return /* @__PURE__ */ (0, x.jsxs)(R, {
		value: e,
		onChange: t,
		children: [
			/* @__PURE__ */ (0, x.jsx)("option", {
				value: "",
				children: "— ברירת מחדל —"
			}),
			i ? null : /* @__PURE__ */ (0, x.jsxs)("option", {
				value: e,
				children: [e, " · מוגדר כעת"]
			}),
			n.map((e) => /* @__PURE__ */ (0, x.jsxs)("option", {
				value: e.id,
				children: [e.name || e.id, e.contextLength ? ` · ${Number(e.contextLength).toLocaleString()}` : ""]
			}, e.id))
		]
	});
}
function re({ form: e, update: t, configStatus: n }) {
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		style: M.section,
		children: [
			/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("p", {
				style: M.sectionTitle,
				children: "OpenRouter"
			}), /* @__PURE__ */ (0, x.jsxs)("div", {
				style: M.card,
				children: [/* @__PURE__ */ (0, x.jsxs)("div", {
					style: {
						display: "flex",
						alignItems: "center",
						gap: 8,
						marginBottom: 14
					},
					children: [/* @__PURE__ */ (0, x.jsx)(V, { ok: n?.openRouter }), /* @__PURE__ */ (0, x.jsx)("span", {
						style: {
							fontSize: 12.5,
							color: "var(--text-secondary)"
						},
						children: n?.openRouter ? "OpenRouter מוגדר" : "OpenRouter לא מוגדר"
					})]
				}), /* @__PURE__ */ (0, x.jsx)(te, {
					label: "OpenRouter API Key",
					value: e.secrets?.openRouterApiKey,
					onChange: (e) => t("secrets.openRouterApiKey", e),
					placeholder: "sk-or-...",
					hint: "השאר ריק כדי לשמור את הערך הקיים"
				})]
			})] }),
			/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("p", {
				style: M.sectionTitle,
				children: "App Supabase"
			}), /* @__PURE__ */ (0, x.jsxs)("div", {
				style: {
					...M.card,
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
						children: [/* @__PURE__ */ (0, x.jsx)(V, { ok: n?.supabase }), /* @__PURE__ */ (0, x.jsx)("span", {
							style: {
								fontSize: 12.5,
								color: "var(--text-secondary)"
							},
							children: n?.supabase ? "App Supabase מוגדר" : "App Supabase לא מוגדר"
						})]
					}),
					/* @__PURE__ */ (0, x.jsx)(N, {
						label: "Supabase URL",
						children: /* @__PURE__ */ (0, x.jsx)(L, {
							value: e.secrets?.supabaseUrl,
							onChange: (e) => t("secrets.supabaseUrl", e),
							placeholder: "https://xxxx.supabase.co"
						})
					}),
					/* @__PURE__ */ (0, x.jsx)(te, {
						label: "Service Role Key",
						value: e.secrets?.supabaseServiceRoleKey,
						onChange: (e) => t("secrets.supabaseServiceRoleKey", e),
						placeholder: "eyJ...",
						hint: "השאר ריק כדי לשמור את הערך הקיים"
					})
				]
			})] }),
			/* @__PURE__ */ (0, x.jsxs)(F, { children: [
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
function ie({ agent: e, models: t, form: n, update: r }) {
	let i = n.models?.[e.key] || "", a = n.prompts?.[e.key] || "", o = n.ai?.[e.key] || {};
	return /* @__PURE__ */ (0, x.jsxs)("article", {
		style: {
			...M.card,
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
						...M.hint,
						marginTop: 2
					},
					children: e.desc
				})] })
			}),
			/* @__PURE__ */ (0, x.jsx)(N, {
				label: "מודל",
				children: /* @__PURE__ */ (0, x.jsx)(ne, {
					value: i,
					onChange: (t) => r(`models.${e.key}`, t),
					models: t
				})
			}),
			/* @__PURE__ */ (0, x.jsx)(B, {
				title: "פרומפט",
				children: /* @__PURE__ */ (0, x.jsx)(ee, {
					value: a,
					rows: e.promptRows,
					onChange: (t) => r(`prompts.${e.key}`, t),
					placeholder: "פרומפט ברירת מחדל — השאר ריק כדי להשתמש בקבוע מ-prompts.js"
				})
			}),
			/* @__PURE__ */ (0, x.jsx)(B, {
				title: "הגדרות מודל",
				defaultOpen: !0,
				children: /* @__PURE__ */ (0, x.jsxs)("div", {
					style: {
						...M.grid3,
						marginTop: 8
					},
					children: [
						/* @__PURE__ */ (0, x.jsx)(N, {
							label: "Temperature",
							info: w.temperature,
							children: /* @__PURE__ */ (0, x.jsx)(L, {
								type: "number",
								value: o.temperature ?? 0,
								min: 0,
								max: 2,
								step: .05,
								onChange: (t) => r(`ai.${e.key}.temperature`, t)
							})
						}),
						/* @__PURE__ */ (0, x.jsx)(N, {
							label: "Max Tokens",
							info: w.maxTokens,
							children: /* @__PURE__ */ (0, x.jsx)(L, {
								type: "number",
								value: o.maxTokens ?? 4096,
								min: 16,
								max: 32e3,
								step: 50,
								onChange: (t) => r(`ai.${e.key}.maxTokens`, t)
							})
						}),
						/* @__PURE__ */ (0, x.jsx)(N, {
							label: "Timeout (ms)",
							info: w.timeoutMs,
							children: /* @__PURE__ */ (0, x.jsx)(L, {
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
function ae({ models: e, form: t, update: n, onRefreshModels: r, modelStatus: i }) {
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		style: M.section,
		children: [/* @__PURE__ */ (0, x.jsxs)("div", {
			style: {
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
				gap: 12,
				flexWrap: "wrap"
			},
			children: [/* @__PURE__ */ (0, x.jsx)(F, { children: "כל מה שמשפיע על תשובות הצ׳אט: מודלים, פרומפטים, הגדרות temperature ו-maxTokens לכל סוכן. השאר שדה ריק כדי להשתמש בפרומפט ברירת המחדל מ-prompts.js." }), /* @__PURE__ */ (0, x.jsxs)("div", {
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
				}), /* @__PURE__ */ (0, x.jsxs)(we, {
					onClick: r,
					title: "רענן רשימת מודלים מ-OpenRouter",
					children: [/* @__PURE__ */ (0, x.jsx)(A, {
						path: j.reload,
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
			children: C.map((r) => /* @__PURE__ */ (0, x.jsx)(ie, {
				agent: r,
				models: e,
				form: t,
				update: n
			}, r.key))
		})]
	});
}
var oe = [
	{
		key: "extraction",
		index: "01",
		title: "חילוץ חוזה",
		desc: "קורא את ה־PDF ומחלץ עובדות זמן, אבני דרך, תנאים והשלכות לעיון אנושי.",
		models: [["primaryModel", "מודל ראשי"], ["retryModel", "מודל חלופי"]],
		numbers: [
			[
				"temperature",
				"Temperature",
				0,
				1,
				.05,
				0
			],
			[
				"maxTokens",
				"Max tokens",
				512,
				16e3,
				256,
				4096
			],
			[
				"timeoutMs",
				"Timeout לקריאה (ms)",
				5e3,
				18e4,
				5e3,
				12e4
			],
			[
				"totalBudgetMs",
				"תקציב כולל (ms)",
				3e4,
				6e5,
				1e4,
				27e4
			],
			[
				"concurrency",
				"מקביליות chunks",
				1,
				6,
				1,
				3
			],
			[
				"maxChunkCharacters",
				"מקסימום תווים ל־chunk",
				1200,
				1e4,
				100,
				1e4
			],
			[
				"maxChunkPages",
				"מקסימום עמודים ל־chunk",
				1,
				10,
				1,
				5
			],
			[
				"repairTimeoutMs",
				"Timeout לתיקון (ms)",
				5e3,
				18e4,
				5e3,
				6e4
			]
		],
		prompts: [["systemPrompt", "פרומפט חילוץ ראשי"], ["repairPrompt", "פרומפט תיקון JSON"]]
	},
	{
		key: "enrichment",
		index: "02",
		title: "העשרת סעיפים",
		desc: "מסכם סעיפים מאומתים ומוסיף תגיות מבוקרות לצורך אחזור וחיפוש.",
		models: [["model", "מודל העשרה"]],
		numbers: [
			[
				"temperature",
				"Temperature",
				0,
				1,
				.05,
				0
			],
			[
				"maxTokensPerCall",
				"Tokens לקריאה",
				256,
				1600,
				100,
				1600
			],
			[
				"maxTotalModelTokens",
				"תקציב tokens כולל",
				1600,
				96e3,
				1e3,
				48e3
			],
			[
				"timeoutMs",
				"Timeout לקריאה (ms)",
				5e3,
				18e4,
				5e3,
				75e3
			],
			[
				"totalBudgetMs",
				"תקציב זמן כולל (ms)",
				3e4,
				6e5,
				1e4,
				18e4
			],
			[
				"concurrency",
				"מקביליות",
				1,
				4,
				1,
				2
			],
			[
				"maxRepairBatches",
				"מקסימום תיקוני batch",
				0,
				10,
				1,
				5
			],
			[
				"maxProviderRetries",
				"ניסיונות ספק נוספים",
				0,
				3,
				1,
				1
			]
		],
		prompts: [["systemPrompt", "פרומפט העשרת סעיפים"]]
	},
	{
		key: "relationships",
		index: "03",
		title: "קשרים סמנטיים",
		desc: "מסווג קשרים בין סעיפים ומעביר כל הצעה דרך בודק ספקני נפרד.",
		models: [["model", "מודל מסווג"], ["verifierModel", "מודל בודק"]],
		numbers: [
			[
				"temperature",
				"Temperature",
				0,
				1,
				.05,
				0
			],
			[
				"maxCandidates",
				"מקסימום זוגות",
				1,
				96,
				1,
				48
			],
			[
				"maxTokensPerCall",
				"Tokens למסווג",
				512,
				600,
				10,
				600
			],
			[
				"verifierMaxTokensPerCall",
				"Tokens לבודק",
				350,
				700,
				10,
				700
			],
			[
				"maxTotalModelTokens",
				"תקציב tokens כולל",
				1e3,
				6e4,
				1e3,
				2e4
			],
			[
				"timeoutMs",
				"Timeout לקריאה (ms)",
				5e3,
				18e4,
				5e3,
				75e3
			],
			[
				"totalBudgetMs",
				"תקציב זמן כולל (ms)",
				3e4,
				6e5,
				1e4,
				18e4
			],
			[
				"concurrency",
				"מקביליות",
				1,
				4,
				1,
				2
			],
			[
				"confidenceThreshold",
				"סף ביטחון",
				.5,
				.95,
				.01,
				.9
			],
			[
				"conflictConfidenceThreshold",
				"סף ביטחון לסתירה",
				.5,
				.98,
				.01,
				.9
			],
			[
				"maxProviderRetries",
				"ניסיונות ספק נוספים",
				0,
				3,
				1,
				1
			],
			[
				"maxRepairBatches",
				"תיקוני סיווג",
				0,
				5,
				1,
				1
			],
			[
				"maxVerificationRepairBatches",
				"תיקוני בדיקה",
				0,
				5,
				1,
				1
			]
		],
		prompts: [["systemPrompt", "פרומפט סיווג קשרים"], ["verifierPrompt", "פרומפט בודק קשרים"]]
	},
	{
		key: "decisions",
		index: "04",
		title: "נרמול החלטות",
		desc: "הופך קבוצות מועמדים שנבדקו להצעות החלטה חוזיות עקביות בעברית.",
		models: [["model", "מודל החלטות"]],
		numbers: [
			[
				"temperature",
				"Temperature",
				0,
				1,
				.05,
				0
			],
			[
				"maxTokensPerCall",
				"Tokens לקריאה",
				700,
				2200,
				100,
				1600
			],
			[
				"maxTotalModelTokens",
				"תקציב tokens כולל",
				2200,
				2e5,
				1e3,
				18e4
			],
			[
				"timeoutMs",
				"Timeout לקריאה (ms)",
				5e3,
				18e4,
				5e3,
				75e3
			],
			[
				"totalBudgetMs",
				"תקציב זמן כולל (ms)",
				3e4,
				6e5,
				1e4,
				3e5
			],
			[
				"concurrency",
				"מקביליות",
				1,
				3,
				1,
				3
			],
			[
				"maxProviderRetries",
				"ניסיונות ספק נוספים",
				0,
				1,
				1,
				1
			],
			[
				"maxRepairBatches",
				"מקסימום תיקוני batch",
				0,
				5,
				1,
				3
			],
			[
				"maxSplitFallbackCalls",
				"פיצולי fallback",
				0,
				20,
				1,
				8
			]
		],
		prompts: [["systemPrompt", "פרומפט נרמול החלטות"]]
	},
	{
		key: "autoReview",
		index: "05",
		title: "בדיקה אוטומטית",
		desc: "בודק עצמאי שמאשר רק החלטות העומדות גם במדיניות הדטרמיניסטית.",
		models: [["model", "מודל בודק החלטות"]],
		numbers: [
			[
				"temperature",
				"Temperature",
				0,
				1,
				.05,
				0
			],
			[
				"maxTokens",
				"Max tokens",
				512,
				8e3,
				100,
				3200
			],
			[
				"timeoutMs",
				"Timeout לקריאה (ms)",
				5e3,
				18e4,
				5e3,
				75e3
			],
			[
				"totalBudgetMs",
				"תקציב זמן כולל (ms)",
				3e4,
				6e5,
				1e4,
				3e5
			],
			[
				"batchSize",
				"החלטות בכל batch",
				1,
				12,
				1,
				4
			],
			[
				"concurrency",
				"מקביליות",
				1,
				4,
				1,
				2
			],
			[
				"maxRetries",
				"ניסיונות חוזרים",
				0,
				3,
				1,
				1
			]
		],
		prompts: [["systemPrompt", "פרומפט בודק החלטות"]]
	}
];
function se({ stage: e, value: t, update: n, models: r }) {
	let i = `contractsAgent.${e.key}`;
	return /* @__PURE__ */ (0, x.jsxs)("article", {
		style: {
			...M.card,
			display: "flex",
			flexDirection: "column",
			gap: 14,
			borderTop: "3px solid var(--brand-500)",
			background: "linear-gradient(180deg, color-mix(in srgb, var(--brand-50) 45%, var(--surface)) 0, var(--surface) 92px)"
		},
		children: [
			/* @__PURE__ */ (0, x.jsxs)("div", {
				style: {
					display: "flex",
					alignItems: "flex-start",
					justifyContent: "space-between",
					gap: 12
				},
				children: [/* @__PURE__ */ (0, x.jsxs)("div", {
					style: {
						display: "flex",
						gap: 11,
						alignItems: "flex-start"
					},
					children: [/* @__PURE__ */ (0, x.jsx)("span", {
						"aria-hidden": "true",
						style: {
							fontSize: 11,
							fontWeight: 800,
							letterSpacing: 1.2,
							color: "var(--brand-600, var(--brand-500))",
							border: "1px solid var(--brand-200, var(--line-strong))",
							borderRadius: 999,
							padding: "3px 7px"
						},
						children: e.index
					}), /* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("h3", {
						style: {
							margin: 0,
							fontSize: 16,
							fontWeight: 780
						},
						children: e.title
					}), /* @__PURE__ */ (0, x.jsx)("p", {
						style: {
							...M.hint,
							marginTop: 5
						},
						children: e.desc
					})] })]
				}), /* @__PURE__ */ (0, x.jsx)(z, {
					label: "פעיל",
					checked: t.enabled !== !1,
					onChange: (e) => n(`${i}.enabled`, e)
				})]
			}),
			/* @__PURE__ */ (0, x.jsx)("div", {
				style: e.models.length > 1 ? M.grid2 : void 0,
				children: e.models.map(([e, a]) => /* @__PURE__ */ (0, x.jsx)(N, {
					label: a,
					children: /* @__PURE__ */ (0, x.jsx)(ne, {
						value: t[e] || "",
						onChange: (t) => n(`${i}.${e}`, t),
						models: r
					})
				}, e))
			}),
			/* @__PURE__ */ (0, x.jsx)(B, {
				title: "הגדרות מודל ותקציבים",
				defaultOpen: e.key === "extraction",
				children: /* @__PURE__ */ (0, x.jsx)("div", {
					style: {
						display: "grid",
						gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
						gap: 10
					},
					children: e.numbers.map(([e, r, a, o, s, c]) => /* @__PURE__ */ (0, x.jsx)(N, {
						label: r,
						children: /* @__PURE__ */ (0, x.jsx)(L, {
							type: "number",
							min: a,
							max: o,
							step: s,
							value: t[e] ?? c,
							onChange: (t) => n(`${i}.${e}`, t)
						})
					}, e))
				})
			}),
			e.prompts.map(([e, r]) => /* @__PURE__ */ (0, x.jsxs)(B, {
				title: r,
				children: [/* @__PURE__ */ (0, x.jsx)(ee, {
					rows: 12,
					value: t[e] || "",
					onChange: (t) => n(`${i}.${e}`, t),
					placeholder: "ריק = פרומפט ברירת המחדל המאובטח שבקוד"
				}), /* @__PURE__ */ (0, x.jsx)("p", {
					style: {
						...M.hint,
						marginTop: 6
					},
					children: "הפרומפט נשמר בשרת. השאר ריק כדי לקבל עדכוני ברירת מחדל עתידיים."
				})]
			}, e))
		]
	});
}
function ce({ models: e, form: t, update: n, configStatus: r }) {
	let i = t.contractsAgent || {};
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		style: M.section,
		children: [
			/* @__PURE__ */ (0, x.jsxs)("div", {
				style: {
					...M.card,
					padding: "22px 24px",
					display: "grid",
					gridTemplateColumns: "minmax(0, 1fr) auto",
					gap: 20,
					alignItems: "center",
					borderInlineStart: "5px solid var(--brand-500)",
					background: "linear-gradient(115deg, color-mix(in srgb, var(--brand-50) 70%, var(--surface)) 0%, var(--surface) 58%)"
				},
				children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [
					/* @__PURE__ */ (0, x.jsx)("p", {
						style: {
							margin: 0,
							fontSize: 11,
							fontWeight: 800,
							letterSpacing: 1.3,
							color: "var(--brand-600, var(--brand-500))"
						},
						children: "CONTRACTS PIPELINE"
					}),
					/* @__PURE__ */ (0, x.jsx)("h2", {
						style: {
							margin: "5px 0 7px",
							fontSize: 21,
							lineHeight: 1.25
						},
						children: "הגדרות סוכן החוזים"
					}),
					/* @__PURE__ */ (0, x.jsx)("p", {
						style: {
							...M.hint,
							maxWidth: 720
						},
						children: "שליטה מרכזית במודלים, פרומפטים, זמני המתנה ותקציבי הריצה של כל שלבי ניתוח החוזה. מודל ריק יורש את מודל Main או Lite המתאים."
					}),
					/* @__PURE__ */ (0, x.jsxs)("div", {
						style: {
							display: "flex",
							alignItems: "center",
							gap: 8,
							marginTop: 12,
							fontSize: 12.5,
							color: "var(--text-secondary)"
						},
						children: [/* @__PURE__ */ (0, x.jsx)(V, { ok: r?.openRouter }), r?.openRouter ? "OpenRouter מוגדר" : "נדרש מפתח OpenRouter בכרטיסיית חיבורים"]
					})
				] }), /* @__PURE__ */ (0, x.jsx)(z, {
					label: "הפעל סוכן חוזים",
					checked: i.enabled !== !1,
					onChange: (e) => n("contractsAgent.enabled", e)
				})]
			}),
			/* @__PURE__ */ (0, x.jsx)(F, { children: "הגדרות אלה משפיעות רק על קריאות המודל. הרשאות כתיבה, שערי rollout, אימות ראיות והצורך בסקירה אנושית נשארים נעולים ומאומתים בצד השרת." }),
			/* @__PURE__ */ (0, x.jsx)("div", {
				style: {
					display: "grid",
					gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
					gap: 14
				},
				children: oe.map((t) => /* @__PURE__ */ (0, x.jsx)(se, {
					stage: t,
					value: i[t.key] || {},
					update: n,
					models: e
				}, t.key))
			})
		]
	});
}
function le({ models: e, form: t, update: n }) {
	return e.filter((e) => e.id?.includes("embed") || e.id?.includes("text-embed")), /* @__PURE__ */ (0, x.jsxs)("div", {
		style: M.section,
		children: [
			/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("p", {
				style: M.sectionTitle,
				children: "Embedding & Hybrid Search"
			}), /* @__PURE__ */ (0, x.jsx)("div", {
				style: M.card,
				children: /* @__PURE__ */ (0, x.jsxs)("div", {
					style: {
						...M.grid2,
						gap: 12
					},
					children: [
						/* @__PURE__ */ (0, x.jsx)(N, {
							label: "Embedding Model",
							wide: !0,
							info: w.embeddingModel,
							children: /* @__PURE__ */ (0, x.jsx)(ne, {
								value: t.models?.embedding,
								onChange: (e) => n("models.embedding", e),
								models: e
							})
						}),
						/* @__PURE__ */ (0, x.jsx)(N, {
							label: "Hybrid RPC Name",
							wide: !0,
							info: w.hybridRpcName,
							children: /* @__PURE__ */ (0, x.jsx)(L, {
								value: t.retrieval?.rpcName,
								onChange: (e) => n("retrieval.rpcName", e),
								placeholder: "hybrid_match_data_index_..."
							})
						}),
						/* @__PURE__ */ (0, x.jsx)(N, {
							label: "Hybrid Candidates",
							info: w.hybridCandidates,
							children: /* @__PURE__ */ (0, x.jsx)(L, {
								type: "number",
								value: t.retrieval?.candidates ?? 40,
								min: 1,
								max: 200,
								onChange: (e) => n("retrieval.candidates", e)
							})
						}),
						/* @__PURE__ */ (0, x.jsx)(N, {
							label: "Planner Candidates",
							info: w.plannerCandidates,
							children: /* @__PURE__ */ (0, x.jsx)(L, {
								type: "number",
								value: t.retrieval?.plannerCandidates ?? 20,
								min: 1,
								max: 100,
								onChange: (e) => n("retrieval.plannerCandidates", e)
							})
						}),
						/* @__PURE__ */ (0, x.jsx)(N, {
							label: "Alert Candidates",
							info: w.alertCandidates,
							children: /* @__PURE__ */ (0, x.jsx)(L, {
								type: "number",
								value: t.retrieval?.alertCandidates ?? 20,
								min: 1,
								max: 100,
								onChange: (e) => n("retrieval.alertCandidates", e)
							})
						}),
						/* @__PURE__ */ (0, x.jsx)(N, {
							label: "Reranker Top-K",
							info: w.rerankTopK,
							children: /* @__PURE__ */ (0, x.jsx)(L, {
								type: "number",
								value: t.retrieval?.rerankTopK ?? 10,
								min: 1,
								max: 100,
								onChange: (e) => n("retrieval.rerankTopK", e)
							})
						}),
						/* @__PURE__ */ (0, x.jsx)(N, {
							label: "Vector Weight",
							info: w.vectorWeight,
							children: /* @__PURE__ */ (0, x.jsx)(L, {
								type: "number",
								value: t.retrieval?.vectorWeight ?? .65,
								min: 0,
								max: 1,
								step: .05,
								onChange: (e) => n("retrieval.vectorWeight", e)
							})
						}),
						/* @__PURE__ */ (0, x.jsx)(N, {
							label: "Keyword Weight",
							info: w.keywordWeight,
							children: /* @__PURE__ */ (0, x.jsx)(L, {
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
					style: M.sectionTitle,
					children: "RAG Context"
				}),
				/* @__PURE__ */ (0, x.jsx)(F, { children: "קובע כמה מקורות וכמה טקסט מכל מקור נכנסים בפועל לתשובת ה-AI. השורות מצטמצמות לאורך המשפך: אחזור ראשוני → דירוג מחדש → context שנכנס לסוכן הראשי." }),
				/* @__PURE__ */ (0, x.jsx)("div", {
					style: {
						...M.card,
						marginTop: 10
					},
					children: /* @__PURE__ */ (0, x.jsxs)("div", {
						style: M.grid3,
						children: [
							/* @__PURE__ */ (0, x.jsx)(N, {
								label: "Context Records",
								info: w.ragContextRecordsLimit,
								children: /* @__PURE__ */ (0, x.jsx)(L, {
									type: "number",
									value: t.rag?.contextRecordsLimit ?? 12,
									min: 1,
									max: 50,
									onChange: (e) => n("rag.contextRecordsLimit", e)
								})
							}),
							/* @__PURE__ */ (0, x.jsx)(N, {
								label: "Chunk Text Limit",
								info: w.ragChunkTextLimit,
								children: /* @__PURE__ */ (0, x.jsx)(L, {
									type: "number",
									value: t.rag?.chunkTextLimit ?? 1800,
									min: 100,
									max: 1e4,
									onChange: (e) => n("rag.chunkTextLimit", e)
								})
							}),
							/* @__PURE__ */ (0, x.jsx)(N, {
								label: "Planner Extra Queries",
								info: w.ragPlannerExtraQueriesLimit,
								children: /* @__PURE__ */ (0, x.jsx)(L, {
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
					style: M.sectionTitle,
					children: "Graph Context"
				}),
				/* @__PURE__ */ (0, x.jsx)(F, { children: "קובע האם וכמה קשרים מגרף הפרויקט ייכנסו לשאלות RAG — קישורי לוח זמנים, קשרי ישויות ואיתותים." }),
				/* @__PURE__ */ (0, x.jsxs)("div", {
					style: {
						...M.card,
						marginTop: 10,
						display: "flex",
						flexDirection: "column",
						gap: 14
					},
					children: [
						/* @__PURE__ */ (0, x.jsxs)("div", {
							style: M.grid2,
							children: [/* @__PURE__ */ (0, x.jsx)(N, {
								label: "Graph Search Limit",
								info: w.graphSearchLimit,
								children: /* @__PURE__ */ (0, x.jsx)(L, {
									type: "number",
									value: t.graph?.searchLimit ?? 30,
									min: 1,
									max: 100,
									onChange: (e) => n("graph.searchLimit", e)
								})
							}), /* @__PURE__ */ (0, x.jsx)(N, {
								label: "Graph Context Limit",
								info: w.graphContextLimit,
								children: /* @__PURE__ */ (0, x.jsx)(L, {
									type: "number",
									value: t.graph?.contextLimit ?? 12,
									min: 1,
									max: 50,
									onChange: (e) => n("graph.contextLimit", e)
								})
							})]
						}),
						/* @__PURE__ */ (0, x.jsx)(z, {
							label: "להשתמש בגרף בתשובות צ׳אט",
							checked: t.graph?.enabled !== !1,
							onChange: (e) => n("graph.enabled", e),
							info: w.graphEnabled
						}),
						/* @__PURE__ */ (0, x.jsx)(z, {
							label: "להרחיב גרף בשאלות רשימה/חקירה",
							checked: t.graph?.expandedForListQuestions !== !1,
							onChange: (e) => n("graph.expandedForListQuestions", e),
							info: w.graphExpandedForListQuestions
						})
					]
				})
			] }),
			/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("p", {
				style: M.sectionTitle,
				children: "Timeline"
			}), /* @__PURE__ */ (0, x.jsx)("div", {
				style: M.card,
				children: /* @__PURE__ */ (0, x.jsxs)("div", {
					style: M.grid2,
					children: [/* @__PURE__ */ (0, x.jsx)(N, {
						label: "Timeline Limit (rows)",
						info: w.timelineLimit,
						children: /* @__PURE__ */ (0, x.jsx)(L, {
							type: "number",
							value: t.retrieval?.timelineLimit ?? 1e3,
							min: 10,
							max: 1e4,
							onChange: (e) => n("retrieval.timelineLimit", e)
						})
					}), /* @__PURE__ */ (0, x.jsx)(N, {
						label: "Days Back",
						info: w.timelineDaysBack,
						children: /* @__PURE__ */ (0, x.jsx)(L, {
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
function ue({ form: e, update: t, configStatus: n }) {
	let r = e.contentSource?.useAppSupabase === !0;
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		style: M.section,
		children: [
			/* @__PURE__ */ (0, x.jsxs)("div", {
				style: {
					display: "flex",
					alignItems: "center",
					gap: 8
				},
				children: [/* @__PURE__ */ (0, x.jsx)(V, { ok: n?.contentSupabase }), /* @__PURE__ */ (0, x.jsx)("span", {
					style: {
						fontSize: 12.5,
						color: "var(--text-secondary)"
					},
					children: n?.contentSupabase ? "APP DATA מוגדר" : "APP DATA לא מוגדר — המערכת תשתמש ב-App Supabase"
				})]
			}),
			/* @__PURE__ */ (0, x.jsxs)("div", {
				style: {
					...M.card,
					display: "flex",
					flexDirection: "column",
					gap: 12
				},
				children: [
					/* @__PURE__ */ (0, x.jsx)(z, {
						label: "השתמש ב-App Supabase של MAIN",
						checked: r,
						onChange: (e) => t("contentSource.useAppSupabase", e)
					}),
					/* @__PURE__ */ (0, x.jsx)(N, {
						label: "APP DATA Supabase URL",
						children: /* @__PURE__ */ (0, x.jsx)(L, {
							value: e.contentSource?.supabaseUrl,
							onChange: (e) => t("contentSource.supabaseUrl", e),
							placeholder: "https://content-project.supabase.co",
							disabled: r
						})
					}),
					/* @__PURE__ */ (0, x.jsx)(te, {
						label: "Service Role Key",
						value: e.contentSource?.supabaseServiceRoleKey,
						onChange: (e) => t("contentSource.supabaseServiceRoleKey", e),
						placeholder: "sb_secret_...",
						disabled: r
					}),
					/* @__PURE__ */ (0, x.jsxs)("div", {
						style: M.grid2,
						children: [
							/* @__PURE__ */ (0, x.jsx)(N, {
								label: "Hybrid RPC Name",
								children: /* @__PURE__ */ (0, x.jsx)(L, {
									value: e.contentSource?.hybridRpcName,
									onChange: (e) => t("contentSource.hybridRpcName", e),
									placeholder: "hybrid_match_data_index..."
								})
							}),
							/* @__PURE__ */ (0, x.jsx)(N, {
								label: "Index Table",
								children: /* @__PURE__ */ (0, x.jsx)(L, {
									value: e.contentSource?.indexTable,
									onChange: (e) => t("contentSource.indexTable", e),
									placeholder: "data_index_embeddings_gf"
								})
							}),
							/* @__PURE__ */ (0, x.jsx)(N, {
								label: "Alerts Table",
								children: /* @__PURE__ */ (0, x.jsx)(L, {
									value: e.contentSource?.alertsTable,
									onChange: (e) => t("contentSource.alertsTable", e),
									placeholder: "alerts_embeddings_gf"
								})
							}),
							/* @__PURE__ */ (0, x.jsx)(N, {
								label: "Alerts RPC Name",
								children: /* @__PURE__ */ (0, x.jsx)(L, {
									value: e.contentSource?.alertsRpcName,
									onChange: (e) => t("contentSource.alertsRpcName", e),
									placeholder: "match_alerts_embeddings_gf"
								})
							})
						]
					})
				]
			}),
			/* @__PURE__ */ (0, x.jsx)(F, { children: "APP DATA הוא פרויקט KAPAIM ב-Supabase ומשמש את כל סוכני המידע, RAG, timeline, alerts ו-Schedule. כשהמתג פעיל, הכתובת והמפתח נלקחים מחיבור App Supabase של MAIN." })
		]
	});
}
function de({ form: e, update: t }) {
	let n = Object.keys(e.tools || {});
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		style: M.section,
		children: [
			/* @__PURE__ */ (0, x.jsx)(F, { children: "כתובת ה-n8n Base URL משמשת בסיס לכל ה-webhooks. כתובות ספציפיות לכלי עוקפות את ה-Base URL עבור אותו כלי בלבד. אם אין שימוש ב-n8n ניתן להשאיר ריק." }),
			/* @__PURE__ */ (0, x.jsx)("div", {
				style: M.card,
				children: /* @__PURE__ */ (0, x.jsx)(N, {
					label: "n8n Base URL",
					hint: "כתובת ה-n8n instance שממנה נקראים ה-webhooks",
					children: /* @__PURE__ */ (0, x.jsx)(L, {
						value: e.n8nBaseUrl,
						onChange: (e) => t("n8nBaseUrl", e),
						placeholder: "https://your-n8n.cloud/webhook"
					})
				})
			}),
			n.length > 0 && /* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("p", {
				style: M.sectionTitle,
				children: "כתובות כלים"
			}), /* @__PURE__ */ (0, x.jsx)("div", {
				style: {
					...M.card,
					display: "flex",
					flexDirection: "column",
					gap: 10
				},
				children: n.map((n) => /* @__PURE__ */ (0, x.jsx)(N, {
					label: n,
					children: /* @__PURE__ */ (0, x.jsx)(L, {
						value: e.tools[n],
						onChange: (e) => t(`tools.${n}`, e),
						placeholder: `Override URL for ${n}`
					})
				}, n))
			})] })
		]
	});
}
function fe({ form: e, update: t }) {
	let n = e.memory || {}, [r, i] = (0, b.useState)({
		memoryItems: 0,
		sessions: 0,
		lastUpdatedAt: null,
		mode: "session_only"
	}), [a, o] = (0, b.useState)(""), s = (0, b.useCallback)(() => {
		E("/api/memory/stats").then(i).catch(() => i((e) => ({
			...e,
			degraded: !0
		})));
	}, []);
	(0, b.useEffect)(() => {
		s();
	}, [s]);
	let c = async () => {
		let e = localStorage.getItem("sessionId");
		if (!e) return o("לא נמצאה שיחה נוכחית בדפדפן.");
		if (window.confirm("למחוק את סיכום הזיכרון של השיחה הנוכחית? היסטוריית ההודעות עצמה לא תימחק.")) try {
			await E(`/api/memory/session/${encodeURIComponent(e)}`, { method: "DELETE" }), o("זיכרון השיחה הנוכחית נמחק."), s();
		} catch {
			o("לא נמצא זיכרון שיחה למחיקה או שהמחיקה נכשלה.");
		}
	}, l = async () => {
		if (window.confirm("פעולה זו תמחק את כל הזיכרונות האישיים ואת כל סיכומי השיחות שלך. לא ניתן לבטל אותה. להמשיך?")) {
			if (window.prompt("לאישור סופי, הקלד DELETE_ALL_MEMORY") !== "DELETE_ALL_MEMORY") return o("המחיקה בוטלה — טקסט האישור לא תאם.");
			try {
				await E("/api/memory/me", {
					method: "DELETE",
					body: { confirm: "DELETE_ALL_MEMORY" }
				}), o("כל הזיכרון האישי נמחק."), s();
			} catch {
				o("מחיקת הזיכרון האישי נכשלה.");
			}
		}
	};
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		style: M.section,
		children: [
			/* @__PURE__ */ (0, x.jsxs)("div", {
				style: {
					...M.card,
					borderInlineStart: "4px solid var(--brand-500)"
				},
				children: [/* @__PURE__ */ (0, x.jsx)("p", {
					style: {
						margin: 0,
						fontSize: 14,
						fontWeight: 700
					},
					children: "זיכרון שיחה אינו Cache"
				}), /* @__PURE__ */ (0, x.jsx)("p", {
					style: {
						...M.hint,
						marginTop: 7
					},
					children: "הזיכרון שומר הקשר, סיכומי שיחה והעדפות משתמש ב־Supabase. ה־Cache רק מאיץ פעולות חוזרות, מותר למחיקה בכל רגע ואינו מקור להקשר שיחה."
				})]
			}),
			/* @__PURE__ */ (0, x.jsxs)("div", { children: [
				/* @__PURE__ */ (0, x.jsx)("p", {
					style: M.sectionTitle,
					children: "מצב וסטטיסטיקה"
				}),
				/* @__PURE__ */ (0, x.jsxs)("div", {
					style: { ...M.grid3 },
					children: [
						/* @__PURE__ */ (0, x.jsx)(pe, {
							label: "זיכרונות אישיים",
							value: r.memoryItems ?? 0
						}),
						/* @__PURE__ */ (0, x.jsx)(pe, {
							label: "שיחות עם סיכום",
							value: r.sessions ?? 0
						}),
						/* @__PURE__ */ (0, x.jsx)(pe, {
							label: "עדכון אחרון",
							value: r.lastUpdatedAt ? new Date(r.lastUpdatedAt).toLocaleString("he-IL") : "—"
						})
					]
				}),
				/* @__PURE__ */ (0, x.jsxs)("p", {
					style: {
						...M.hint,
						marginTop: 8
					},
					children: [
						"מצב נוכחי: ",
						r.mode === "user_and_session" ? "זיכרון משתמש + שיחה" : "זיכרון שיחה בלבד",
						r.degraded ? " · שירות הזיכרון לא זמין כרגע" : ""
					]
				})
			] }),
			/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("p", {
				style: M.sectionTitle,
				children: "הגדרות כלליות"
			}), /* @__PURE__ */ (0, x.jsxs)("div", {
				style: {
					...M.card,
					display: "flex",
					flexDirection: "column",
					gap: 14
				},
				children: [
					/* @__PURE__ */ (0, x.jsx)(z, {
						label: "להפעיל זיכרון",
						checked: n.enabled !== !1,
						onChange: (e) => t("memory.enabled", e)
					}),
					/* @__PURE__ */ (0, x.jsx)(z, {
						label: "זיכרון בין שיחות",
						checked: n.crossSessionEnabled !== !1,
						onChange: (e) => t("memory.crossSessionEnabled", e)
					}),
					/* @__PURE__ */ (0, x.jsxs)("div", {
						style: M.grid3,
						children: [
							/* @__PURE__ */ (0, x.jsx)(N, {
								label: "מדיניות כתיבה",
								children: /* @__PURE__ */ (0, x.jsxs)(R, {
									value: n.writePolicy || "hybrid",
									onChange: (e) => t("memory.writePolicy", e),
									children: [
										/* @__PURE__ */ (0, x.jsx)("option", {
											value: "explicit",
											children: "רק בקשת ״זכור״"
										}),
										/* @__PURE__ */ (0, x.jsx)("option", {
											value: "automatic",
											children: "אוטומטית בלבד"
										}),
										/* @__PURE__ */ (0, x.jsx)("option", {
											value: "hybrid",
											children: "היברידית — מומלץ"
										})
									]
								})
							}),
							/* @__PURE__ */ (0, x.jsx)(N, {
								label: "סף למידה אוטומטית",
								children: /* @__PURE__ */ (0, x.jsx)(L, {
									type: "number",
									value: n.autoLearnMinConfidence ?? .85,
									min: 0,
									max: 1,
									step: .01,
									onChange: (e) => t("memory.autoLearnMinConfidence", e)
								})
							}),
							/* @__PURE__ */ (0, x.jsx)(N, {
								label: "רענון סיכום בכל N תורות",
								children: /* @__PURE__ */ (0, x.jsx)(L, {
									type: "number",
									value: n.summaryRefreshEveryTurns ?? 4,
									min: 1,
									max: 50,
									onChange: (e) => t("memory.summaryRefreshEveryTurns", e)
								})
							}),
							/* @__PURE__ */ (0, x.jsx)(N, {
								label: "שמירה (ימים)",
								children: /* @__PURE__ */ (0, x.jsx)(L, {
									type: "number",
									value: n.retentionDays ?? 365,
									min: 1,
									max: 3650,
									onChange: (e) => t("memory.retentionDays", e)
								})
							}),
							/* @__PURE__ */ (0, x.jsx)(N, {
								label: "מקסימום פריטים למשתמש",
								children: /* @__PURE__ */ (0, x.jsx)(L, {
									type: "number",
									value: n.maxItemsPerUser ?? 1e3,
									min: 1,
									max: 1e4,
									onChange: (e) => t("memory.maxItemsPerUser", e)
								})
							}),
							/* @__PURE__ */ (0, x.jsx)(N, {
								label: "תורות ל־Classifier",
								children: /* @__PURE__ */ (0, x.jsx)(L, {
									type: "number",
									value: n.routingRecentTurns ?? 4,
									min: 0,
									max: 20,
									onChange: (e) => t("memory.routingRecentTurns", e)
								})
							}),
							/* @__PURE__ */ (0, x.jsx)(N, {
								label: "תקציב טוקנים לניתוב",
								children: /* @__PURE__ */ (0, x.jsx)(L, {
									type: "number",
									value: n.routingTokenBudget ?? 1200,
									min: 100,
									max: 8e3,
									step: 100,
									onChange: (e) => t("memory.routingTokenBudget", e)
								})
							}),
							/* @__PURE__ */ (0, x.jsx)(N, {
								label: "מודל Embedding",
								children: /* @__PURE__ */ (0, x.jsx)(L, {
									value: "openai/text-embedding-3-large",
									onChange: () => {},
									disabled: !0
								})
							}),
							/* @__PURE__ */ (0, x.jsx)(N, {
								label: "ממדי Embedding",
								children: /* @__PURE__ */ (0, x.jsx)(L, {
									value: "3072",
									onChange: () => {},
									disabled: !0
								})
							})
						]
					})
				]
			})] }),
			/* @__PURE__ */ (0, x.jsxs)("div", {
				style: M.grid2,
				children: [/* @__PURE__ */ (0, x.jsx)(me, {
					agent: "main",
					title: "Main Agent",
					memory: n,
					update: t
				}), /* @__PURE__ */ (0, x.jsx)(me, {
					agent: "lite",
					title: "Lite Agent",
					memory: n,
					update: t
				})]
			}),
			/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("p", {
				style: M.sectionTitle,
				children: "מחיקת נתונים"
			}), /* @__PURE__ */ (0, x.jsxs)("div", {
				style: {
					...M.card,
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					flexWrap: "wrap",
					gap: 12
				},
				children: [
					/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("p", {
						style: {
							margin: 0,
							fontWeight: 700,
							fontSize: 13
						},
						children: "שליטה בזיכרון האישי"
					}), /* @__PURE__ */ (0, x.jsx)("p", {
						style: {
							...M.hint,
							marginTop: 5
						},
						children: "מחיקת session אינה מוחקת הודעות. מחיקה מלאה מסירה זיכרונות אישיים וסיכומי שיחות."
					})] }),
					/* @__PURE__ */ (0, x.jsxs)("div", {
						style: {
							display: "flex",
							gap: 8,
							flexWrap: "wrap"
						},
						children: [/* @__PURE__ */ (0, x.jsx)(we, {
							onClick: c,
							children: "מחק זיכרון שיחה נוכחית"
						}), /* @__PURE__ */ (0, x.jsx)(we, {
							variant: "danger",
							onClick: l,
							children: "מחק את כל הזיכרון שלי"
						})]
					}),
					a && /* @__PURE__ */ (0, x.jsx)("p", {
						role: "status",
						style: {
							...M.hint,
							width: "100%"
						},
						children: a
					})
				]
			})] })
		]
	});
}
function pe({ label: e, value: t }) {
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		style: {
			...M.card,
			padding: "14px 16px"
		},
		children: [/* @__PURE__ */ (0, x.jsx)("p", {
			style: {
				...M.hint,
				marginBottom: 5
			},
			children: e
		}), /* @__PURE__ */ (0, x.jsx)("strong", {
			style: {
				fontSize: 18,
				fontWeight: 750
			},
			children: t
		})]
	});
}
function me({ agent: e, title: t, memory: n, update: r }) {
	let i = n.agents?.[e] || {}, a = `memory.agents.${e}`, o = Number(i.semanticWeight || 0) + Number(i.recencyWeight || 0) + Number(i.importanceWeight || 0);
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		style: {
			...M.card,
			display: "flex",
			flexDirection: "column",
			gap: 14
		},
		children: [
			/* @__PURE__ */ (0, x.jsxs)("div", {
				style: {
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					gap: 10
				},
				children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("p", {
					style: {
						margin: 0,
						fontSize: 15,
						fontWeight: 750
					},
					children: t
				}), /* @__PURE__ */ (0, x.jsx)("p", {
					style: {
						...M.hint,
						marginTop: 3
					},
					children: "תקציב ושליפה עצמאיים"
				})] }), /* @__PURE__ */ (0, x.jsx)(z, {
					label: "פעיל",
					checked: i.enabled !== !1,
					onChange: (e) => r(`${a}.enabled`, e)
				})]
			}),
			/* @__PURE__ */ (0, x.jsxs)("div", {
				style: M.grid2,
				children: [
					/* @__PURE__ */ (0, x.jsx)(N, {
						label: "Recent Turns",
						children: /* @__PURE__ */ (0, x.jsx)(L, {
							type: "number",
							value: i.recentTurns ?? (e === "main" ? 6 : 8),
							min: 0,
							max: 30,
							onChange: (e) => r(`${a}.recentTurns`, e)
						})
					}),
					/* @__PURE__ */ (0, x.jsx)(N, {
						label: "Context Token Budget",
						children: /* @__PURE__ */ (0, x.jsx)(L, {
							type: "number",
							value: i.contextTokenBudget ?? (e === "main" ? 3e3 : 4e3),
							min: 200,
							max: 16e3,
							step: 100,
							onChange: (e) => r(`${a}.contextTokenBudget`, e)
						})
					}),
					/* @__PURE__ */ (0, x.jsx)(N, {
						label: "Semantic Top K",
						children: /* @__PURE__ */ (0, x.jsx)(L, {
							type: "number",
							value: i.semanticTopK ?? (e === "main" ? 6 : 4),
							min: 0,
							max: 30,
							onChange: (e) => r(`${a}.semanticTopK`, e)
						})
					}),
					/* @__PURE__ */ (0, x.jsx)(N, {
						label: "Similarity Threshold",
						children: /* @__PURE__ */ (0, x.jsx)(L, {
							type: "number",
							value: i.similarityThreshold ?? (e === "main" ? .72 : .7),
							min: 0,
							max: 1,
							step: .01,
							onChange: (e) => r(`${a}.similarityThreshold`, e)
						})
					}),
					/* @__PURE__ */ (0, x.jsx)(N, {
						label: "Semantic Weight",
						children: /* @__PURE__ */ (0, x.jsx)(L, {
							type: "number",
							value: i.semanticWeight ?? (e === "main" ? .7 : .65),
							min: 0,
							max: 1,
							step: .05,
							onChange: (e) => r(`${a}.semanticWeight`, e)
						})
					}),
					/* @__PURE__ */ (0, x.jsx)(N, {
						label: "Recency Weight",
						children: /* @__PURE__ */ (0, x.jsx)(L, {
							type: "number",
							value: i.recencyWeight ?? (e === "main" ? .15 : .2),
							min: 0,
							max: 1,
							step: .05,
							onChange: (e) => r(`${a}.recencyWeight`, e)
						})
					}),
					/* @__PURE__ */ (0, x.jsx)(N, {
						label: "Importance Weight",
						children: /* @__PURE__ */ (0, x.jsx)(L, {
							type: "number",
							value: i.importanceWeight ?? .15,
							min: 0,
							max: 1,
							step: .05,
							onChange: (e) => r(`${a}.importanceWeight`, e)
						})
					})
				]
			}),
			/* @__PURE__ */ (0, x.jsx)(z, {
				label: "להשתמש בסיכום שיחה",
				checked: i.useSessionSummary !== !1,
				onChange: (e) => r(`${a}.useSessionSummary`, e)
			}),
			/* @__PURE__ */ (0, x.jsx)(z, {
				label: "להשתמש בזיכרון ארוך טווח",
				checked: i.useLongTermMemory !== !1,
				onChange: (e) => r(`${a}.useLongTermMemory`, e)
			}),
			/* @__PURE__ */ (0, x.jsxs)("p", {
				style: {
					...M.hint,
					color: Math.abs(o - 1) < .001 ? "var(--text-muted)" : "var(--danger)"
				},
				children: [
					"סכום משקלים: ",
					o.toFixed(2),
					Math.abs(o - 1) < .001 ? "" : " — מומלץ שסכום המשקלים יהיה 1.00"
				]
			})
		]
	});
}
function he({ form: e, update: t }) {
	let n = e.toolsRuntime || {}, r = e.ai?.alert || {}, i = e.cache || {}, a = i.provider || "memory";
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		style: M.section,
		children: [
			/* @__PURE__ */ (0, x.jsx)(F, { children: "שולט בהפעלת כלים חיצוניים, סוכן ההתראות וה-Cache — בלי לשנות את כתובות ה-webhooks." }),
			/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("p", {
				style: M.sectionTitle,
				children: "כלי N8N — ריצה"
			}), /* @__PURE__ */ (0, x.jsxs)("div", {
				style: {
					...M.card,
					display: "flex",
					flexDirection: "column",
					gap: 14
				},
				children: [
					/* @__PURE__ */ (0, x.jsx)(z, {
						label: "להפעיל כלי N8N",
						checked: n.enabled !== !1,
						onChange: (e) => t("toolsRuntime.enabled", e),
						info: w.toolsEnabled
					}),
					/* @__PURE__ */ (0, x.jsx)(z, {
						label: "להפעיל Alert Agent",
						checked: n.alertAgentEnabled !== !1,
						onChange: (e) => t("toolsRuntime.alertAgentEnabled", e),
						info: w.toolsAlertAgentEnabled
					}),
					/* @__PURE__ */ (0, x.jsx)(z, {
						label: "להפעיל בדיקת בטיחות מוקדמת",
						checked: n.safetyPrecheckEnabled !== !1,
						onChange: (e) => t("toolsRuntime.safetyPrecheckEnabled", e),
						info: w.toolsSafetyPrecheckEnabled
					}),
					/* @__PURE__ */ (0, x.jsx)(N, {
						label: "Parallel Tool Calls Limit",
						info: w.toolsParallelLimit,
						children: /* @__PURE__ */ (0, x.jsx)(L, {
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
				style: M.sectionTitle,
				children: "סוכן Alert — הגדרות מודל"
			}), /* @__PURE__ */ (0, x.jsx)("div", {
				style: { ...M.card },
				children: /* @__PURE__ */ (0, x.jsxs)("div", {
					style: M.grid3,
					children: [
						/* @__PURE__ */ (0, x.jsx)(N, {
							label: "Temperature",
							info: w.alertTemperature,
							children: /* @__PURE__ */ (0, x.jsx)(L, {
								type: "number",
								value: r.temperature ?? 0,
								min: 0,
								max: 2,
								step: .05,
								onChange: (e) => t("ai.alert.temperature", e)
							})
						}),
						/* @__PURE__ */ (0, x.jsx)(N, {
							label: "Max Tokens",
							info: w.alertMaxTokens,
							children: /* @__PURE__ */ (0, x.jsx)(L, {
								type: "number",
								value: r.maxTokens ?? 4096,
								min: 16,
								max: 32e3,
								step: 50,
								onChange: (e) => t("ai.alert.maxTokens", e)
							})
						}),
						/* @__PURE__ */ (0, x.jsx)(N, {
							label: "Timeout (ms)",
							info: w.alertTimeoutMs,
							children: /* @__PURE__ */ (0, x.jsx)(L, {
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
				style: M.sectionTitle,
				children: "Cache"
			}), /* @__PURE__ */ (0, x.jsxs)("div", {
				style: {
					...M.card,
					display: "flex",
					flexDirection: "column",
					gap: 14
				},
				children: [
					/* @__PURE__ */ (0, x.jsx)(z, {
						label: "להפעיל Cache",
						checked: i.enabled !== !1,
						onChange: (e) => t("cache.enabled", e),
						info: w.cacheEnabled
					}),
					/* @__PURE__ */ (0, x.jsxs)("div", {
						style: M.grid2,
						children: [/* @__PURE__ */ (0, x.jsx)(N, {
							label: "Cache Provider",
							info: w.cacheProvider,
							children: /* @__PURE__ */ (0, x.jsxs)(R, {
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
						}), /* @__PURE__ */ (0, x.jsx)(N, {
							label: "Memory Max Entries",
							info: w.cacheMemoryMaxEntries,
							children: /* @__PURE__ */ (0, x.jsx)(L, {
								type: "number",
								value: i.memoryMaxEntries ?? 1e4,
								min: 100,
								max: 1e6,
								step: 100,
								onChange: (e) => t("cache.memoryMaxEntries", e)
							})
						})]
					}),
					/* @__PURE__ */ (0, x.jsx)(te, {
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
function ge({ form: e, onApplyPreset: t, onSavePreset: n }) {
	let [r, i] = (0, b.useState)(""), [a, o] = (0, b.useState)(""), s = e.presets || [], c = s.find((e) => e.name === r);
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		style: M.section,
		children: [
			/* @__PURE__ */ (0, x.jsx)(F, { children: "בחירה מהירה של תצורות מוכנות. טעינת פריסט מעדכנת את הטופס בלבד — לחץ \"שמור\" כדי לכתוב ל-Supabase." }),
			/* @__PURE__ */ (0, x.jsxs)("div", {
				style: M.card,
				children: [/* @__PURE__ */ (0, x.jsx)("p", {
					style: M.sectionTitle,
					children: "בחר פריסט"
				}), /* @__PURE__ */ (0, x.jsxs)("div", {
					style: {
						display: "flex",
						flexDirection: "column",
						gap: 10
					},
					children: [
						/* @__PURE__ */ (0, x.jsxs)(R, {
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
								...M.hint,
								background: "var(--surface-3)",
								padding: "8px 12px",
								borderRadius: "var(--r)",
								border: "1px solid var(--line)"
							},
							children: c.description || "אין תיאור לפריסט זה."
						}),
						/* @__PURE__ */ (0, x.jsx)(we, {
							onClick: () => r && t(r),
							disabled: !r,
							children: "טען פריסט"
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, x.jsxs)("div", {
				style: M.card,
				children: [/* @__PURE__ */ (0, x.jsx)("p", {
					style: M.sectionTitle,
					children: "שמור פריסט חדש"
				}), /* @__PURE__ */ (0, x.jsxs)("div", {
					style: {
						display: "flex",
						gap: 8
					},
					children: [/* @__PURE__ */ (0, x.jsx)(L, {
						value: a,
						onChange: o,
						placeholder: "שם לפריסט חדש..."
					}), /* @__PURE__ */ (0, x.jsx)(we, {
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
function _e({ form: e, update: t }) {
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		style: M.section,
		children: [
			/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("p", {
				style: M.sectionTitle,
				children: "אזור זמן"
			}), /* @__PURE__ */ (0, x.jsx)("div", {
				style: M.card,
				children: /* @__PURE__ */ (0, x.jsx)(N, {
					label: "אזור זמן",
					hint: "אזור הזמן משפיע על כל שאלות הזמן שנשאלות בסוכן",
					children: /* @__PURE__ */ (0, x.jsx)(R, {
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
				style: M.sectionTitle,
				children: "Knowledge Base Vocabulary"
			}), /* @__PURE__ */ (0, x.jsx)("div", {
				style: M.card,
				children: /* @__PURE__ */ (0, x.jsx)(N, {
					label: "מילות מפתח שמפעילות את Knowledge Base Agent",
					hint: "כאשר אחת מהמילים מופיעה בשאלת המשתמש, המערכת תפעיל את Professional Knowledge Agent",
					children: /* @__PURE__ */ (0, x.jsx)(ee, {
						value: e.knowledge?.triggerKeywords,
						rows: 6,
						onChange: (e) => t("knowledge.triggerKeywords", e),
						placeholder: "חסמים\nסיכונים\nתלויות"
					})
				})
			})] }),
			/* @__PURE__ */ (0, x.jsxs)("div", { children: [
				/* @__PURE__ */ (0, x.jsx)("p", {
					style: M.sectionTitle,
					children: "Knowledge Base — הגדרות מתקדמות"
				}),
				/* @__PURE__ */ (0, x.jsx)(F, { children: "שולט בכמה ידע מקומי נכנס לתכנון החיפוש המקצועי." }),
				/* @__PURE__ */ (0, x.jsx)("div", {
					style: {
						...M.card,
						marginTop: 10
					},
					children: /* @__PURE__ */ (0, x.jsxs)("div", {
						style: M.grid3,
						children: [
							/* @__PURE__ */ (0, x.jsx)(N, {
								label: "Knowledge Agent Limit",
								info: w.knowledgeAgentLimit,
								children: /* @__PURE__ */ (0, x.jsx)(L, {
									type: "number",
									value: e.knowledge?.agentLimit ?? 2,
									min: 1,
									max: 5,
									onChange: (e) => t("knowledge.agentLimit", e)
								})
							}),
							/* @__PURE__ */ (0, x.jsx)(N, {
								label: "Knowledge Top K",
								info: w.knowledgeTopK,
								children: /* @__PURE__ */ (0, x.jsx)(L, {
									type: "number",
									value: e.knowledge?.topK ?? 4,
									min: 1,
									max: 20,
									onChange: (e) => t("knowledge.topK", e)
								})
							}),
							/* @__PURE__ */ (0, x.jsx)(N, {
								label: "Knowledge Chunk Size",
								info: w.knowledgeChunkSize,
								children: /* @__PURE__ */ (0, x.jsx)(L, {
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
var ve = [
	{
		key: "timeFilter",
		label: "מסנן קשר לזמן",
		desc: "שכבה מקדימה לבדיקה קבוצתית בלבד; דילוג בטוח על התראות שאינן קשורות לזמן או ללו״ז."
	},
	{
		key: "extractor",
		label: "חילוץ אירוע",
		desc: "ממיר את ההתראה למבנה עובדתי קשיח."
	},
	{
		key: "matcher",
		label: "התאמה מקצועית",
		desc: "בודק התאמה לתחום, מיקום וסוג העבודה."
	},
	{
		key: "validator",
		label: "בקרת לוח זמנים",
		desc: "בודק תאריכים, היררכיה וסתירות בלו״ז."
	},
	{
		key: "judge",
		label: "שופט",
		desc: "מופעל רק בעמימות, מחלוקת או קרבה לסף."
	},
	{
		key: "embedding",
		label: "Embeddings",
		desc: "מוסיף דירוג סמנטי למועמדים הראשונים."
	}
], ye = [
	["lexical", "חיפוש מילולי"],
	["semantic", "חיפוש סמנטי"],
	["temporal", "התאמה בזמן"],
	["hierarchy", "היררכיית Gantt"],
	["historical", "שיוכים מאושרים קודמים"],
	["projectRag", "RAG פרויקטלי (ניסיוני)"]
], be = [
	["semantic", "סמנטיקה"],
	["lexical", "מילים"],
	["temporal", "זמן"],
	["hierarchy", "היררכיה"],
	["historical", "היסטוריה"],
	["modelConsensus", "הסכמת מודלים"]
];
function xe(e) {
	if (!e) return "טרם פורסם";
	let t = new Date(e);
	return Number.isNaN(t.getTime()) ? String(e) : new Intl.DateTimeFormat("he-IL", {
		dateStyle: "medium",
		timeStyle: "short"
	}).format(t);
}
function H(e) {
	let t = String(e || "");
	if (!t) return "לא זמין";
	let n = t.includes(":") ? t.slice(t.lastIndexOf(":") + 1) : t;
	return n.length > 18 ? `${n.slice(0, 10)}…${n.slice(-6)}` : n;
}
function Se({ form: e, update: t, models: n, scheduleAgentMeta: r }) {
	let i = e.scheduleAssignmentAgent || {}, [a, o] = (0, b.useState)(null), [s, c] = (0, b.useState)({
		projectId: "",
		sourceId: "",
		busy: !1,
		result: null,
		error: ""
	}), l = Object.values(i.weights || {}).reduce((e, t) => e + (Number(t) || 0), 0), u = r?.persisted ? "פורסם ב-Supabase" : "ברירת מחדל מהקוד", d = async () => {
		try {
			o(await E("/api/settings/schedule-assignment-agent/validate", {
				method: "POST",
				body: { settings: i }
			}));
		} catch {
			o({
				ok: !1,
				errors: ["בדיקת ההגדרה נכשלה בשרת."],
				warnings: []
			});
		}
	}, f = async () => {
		c((e) => ({
			...e,
			busy: !0,
			result: null,
			error: ""
		}));
		try {
			let e = await E("/api/settings/schedule-assignment-agent/dry-run", {
				method: "POST",
				body: {
					projectId: s.projectId.trim(),
					sourceId: s.sourceId.trim()
				}
			});
			c((t) => ({
				...t,
				busy: !1,
				result: e
			}));
		} catch {
			c((e) => ({
				...e,
				busy: !1,
				error: "ה־dry-run נכשל. שמור קודם את ההגדרות ובדוק שהפרויקט וההתראה קיימים."
			}));
		}
	};
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		style: M.section,
		children: [
			/* @__PURE__ */ (0, x.jsxs)("div", {
				"data-schedule-agent-publication": !0,
				style: {
					...M.card,
					display: "grid",
					gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
					gap: 14,
					borderColor: r?.persisted ? "var(--success-border)" : "var(--warning-border, var(--line))",
					background: r?.persisted ? "var(--success-bg)" : "var(--surface-2)"
				},
				children: [
					/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("small", {
						style: M.hint,
						children: "סטטוס פעיל"
					}), /* @__PURE__ */ (0, x.jsx)("strong", {
						style: {
							display: "block",
							marginTop: 4
						},
						children: u
					})] }),
					/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("small", {
						style: M.hint,
						children: "גרסת פרומפטים"
					}), /* @__PURE__ */ (0, x.jsx)("strong", {
						dir: "ltr",
						style: {
							display: "block",
							marginTop: 4,
							textAlign: "right",
							overflowWrap: "anywhere"
						},
						children: i.version || "לא הוגדרה"
					})] }),
					/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("small", {
						style: M.hint,
						children: "פורסם לאחרונה"
					}), /* @__PURE__ */ (0, x.jsx)("strong", {
						style: {
							display: "block",
							marginTop: 4
						},
						children: xe(i.publishedAt)
					})] }),
					/* @__PURE__ */ (0, x.jsxs)("div", {
						title: r?.snapshotId || "",
						children: [/* @__PURE__ */ (0, x.jsx)("small", {
							style: M.hint,
							children: "Configuration snapshot"
						}), /* @__PURE__ */ (0, x.jsx)("strong", {
							dir: "ltr",
							style: {
								display: "block",
								marginTop: 4,
								textAlign: "right"
							},
							children: H(r?.snapshotId)
						})]
					})
				]
			}),
			/* @__PURE__ */ (0, x.jsx)(F, { children: "זהו מנגנון מבוקר לכל שורה. בריצה קבוצתית ניתן להפעיל מסנן זמן מקדים; לחיצה ידנית על שורה תמיד מריצה את התהליך המלא. המודלים מציעים ומנמקים בלבד ורכיב המדיניות בשרת הוא היחיד שרשאי לכתוב קשר." }),
			/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("p", {
				style: M.sectionTitle,
				children: "הפעלה והכרעה"
			}), /* @__PURE__ */ (0, x.jsxs)("div", {
				style: {
					...M.card,
					display: "flex",
					flexDirection: "column",
					gap: 16
				},
				children: [/* @__PURE__ */ (0, x.jsxs)("div", {
					style: {
						display: "flex",
						flexWrap: "wrap",
						gap: 22
					},
					children: [/* @__PURE__ */ (0, x.jsx)(z, {
						label: "הפעל סוכן שיוך",
						checked: i.enabled !== !1,
						onChange: (e) => t("scheduleAssignmentAgent.enabled", e)
					}), /* @__PURE__ */ (0, x.jsx)(z, {
						label: "אפשר שיוך אוטומטי לאחר לחיצה",
						checked: i.autoAssignmentEnabled === !0,
						onChange: (e) => t("scheduleAssignmentAgent.autoAssignmentEnabled", e)
					})]
				}), /* @__PURE__ */ (0, x.jsxs)("div", {
					style: M.grid3,
					children: [
						/* @__PURE__ */ (0, x.jsx)(N, {
							label: "סף הסתברות מכוילת לשיוך (%)",
							hint: Number(i.autoAssignmentThreshold) < 85 ? "אזהרה: סף נמוך מ־85% מגדיל סיכון לשיוך שגוי. הסף אינו פעיל ללא ארטיפקט כיול תקף." : "ברירת המחדל: 90%. הסף אינו פעיל ללא ארטיפקט כיול תקף.",
							children: /* @__PURE__ */ (0, x.jsx)(L, {
								type: "number",
								min: 50,
								max: 100,
								value: i.autoAssignmentThreshold ?? 90,
								onChange: (e) => t("scheduleAssignmentAgent.autoAssignmentThreshold", e)
							})
						}),
						/* @__PURE__ */ (0, x.jsx)(N, {
							label: "פער מהמועמד השני",
							hint: "ברירת המחדל: 12 נקודות.",
							children: /* @__PURE__ */ (0, x.jsx)(L, {
								type: "number",
								min: 0,
								max: 100,
								value: i.minimumRunnerUpMargin ?? 12,
								onChange: (e) => t("scheduleAssignmentAgent.minimumRunnerUpMargin", e)
							})
						}),
						/* @__PURE__ */ (0, x.jsx)(N, {
							label: "סף להצגת הצעה",
							children: /* @__PURE__ */ (0, x.jsx)(L, {
								type: "number",
								min: 0,
								max: 100,
								value: i.suggestionThreshold ?? 45,
								onChange: (e) => t("scheduleAssignmentAgent.suggestionThreshold", e)
							})
						}),
						/* @__PURE__ */ (0, x.jsx)(N, {
							label: "סף ביטחון לדילוג במסנן זמן (%)",
							hint: "רק תשובת „לא קשור לזמן” מעל סף זה תדלג על ההתראה. כשל או ספק ממשיכים לבדיקה המלאה.",
							children: /* @__PURE__ */ (0, x.jsx)(L, {
								type: "number",
								min: 50,
								max: 100,
								value: i.timeFilterConfidenceThreshold ?? 80,
								onChange: (e) => t("scheduleAssignmentAgent.timeFilterConfidenceThreshold", e)
							})
						}),
						/* @__PURE__ */ (0, x.jsx)(N, {
							label: "טווח קרוב לסף להפעלת שופט",
							children: /* @__PURE__ */ (0, x.jsx)(L, {
								type: "number",
								min: 0,
								max: 30,
								value: i.judgeNearThresholdRange ?? 8,
								onChange: (e) => t("scheduleAssignmentAgent.judgeNearThresholdRange", e)
							})
						}),
						/* @__PURE__ */ (0, x.jsx)(N, {
							label: "מקסימום מועמדים",
							children: /* @__PURE__ */ (0, x.jsx)(L, {
								type: "number",
								min: 2,
								max: 50,
								value: i.maxCandidates ?? 20,
								onChange: (e) => t("scheduleAssignmentAgent.maxCandidates", e)
							})
						}),
						/* @__PURE__ */ (0, x.jsx)(N, {
							label: "מקסימום קריאות Chat",
							children: /* @__PURE__ */ (0, x.jsx)(L, {
								type: "number",
								min: 0,
								max: 8,
								value: i.maxModelCalls ?? 4,
								onChange: (e) => t("scheduleAssignmentAgent.maxModelCalls", e)
							})
						})
					]
				})]
			})] }),
			/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("p", {
				style: M.sectionTitle,
				children: "מודלים ופרומפטים"
			}), /* @__PURE__ */ (0, x.jsx)("div", {
				style: {
					display: "grid",
					gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
					gap: 12
				},
				children: ve.map((e) => {
					let r = i.roles?.[e.key] || {}, a = e.key === "embedding";
					return /* @__PURE__ */ (0, x.jsxs)("div", {
						style: {
							...M.card,
							display: "flex",
							flexDirection: "column",
							gap: 12
						},
						children: [
							/* @__PURE__ */ (0, x.jsxs)("div", { children: [
								/* @__PURE__ */ (0, x.jsx)(z, {
									label: e.label,
									checked: r.enabled !== !1,
									onChange: (n) => t(`scheduleAssignmentAgent.roles.${e.key}.enabled`, n)
								}),
								/* @__PURE__ */ (0, x.jsx)("p", {
									style: {
										...M.hint,
										marginTop: 6
									},
									children: e.desc
								}),
								a ? null : /* @__PURE__ */ (0, x.jsxs)("div", {
									dir: "ltr",
									style: {
										display: "flex",
										flexWrap: "wrap",
										gap: 6,
										marginTop: 8,
										justifyContent: "flex-end"
									},
									children: [/* @__PURE__ */ (0, x.jsxs)("code", {
										style: {
											fontSize: 10.5,
											padding: "3px 7px",
											borderRadius: 999,
											background: "var(--surface-2)",
											border: "1px solid var(--line)"
										},
										children: ["role: ", r.instructionRole || "system"]
									}), /* @__PURE__ */ (0, x.jsxs)("code", {
										style: {
											fontSize: 10.5,
											padding: "3px 7px",
											borderRadius: 999,
											background: "var(--surface-2)",
											border: "1px solid var(--line)"
										},
										children: [
											r.schemaName || "schema unavailable",
											" · v",
											r.schemaVersion || "?"
										]
									})]
								})
							] }),
							/* @__PURE__ */ (0, x.jsx)(N, {
								label: "מודל",
								children: /* @__PURE__ */ (0, x.jsx)(ne, {
									value: r.model || "",
									onChange: (n) => t(`scheduleAssignmentAgent.roles.${e.key}.model`, n),
									models: n,
									includeEmbedding: a
								})
							}),
							a ? /* @__PURE__ */ (0, x.jsx)(N, {
								label: "מספר מועמדים לחישוב embedding",
								children: /* @__PURE__ */ (0, x.jsx)(L, {
									type: "number",
									min: 1,
									max: 20,
									value: r.candidateLimit ?? 8,
									onChange: (n) => t(`scheduleAssignmentAgent.roles.${e.key}.candidateLimit`, n)
								})
							}) : /* @__PURE__ */ (0, x.jsxs)(x.Fragment, { children: [/* @__PURE__ */ (0, x.jsxs)("div", {
								style: M.grid2,
								children: [/* @__PURE__ */ (0, x.jsx)(N, {
									label: "Temperature",
									children: /* @__PURE__ */ (0, x.jsx)(L, {
										type: "number",
										min: 0,
										max: 1,
										step: .1,
										value: r.temperature ?? 0,
										onChange: (n) => t(`scheduleAssignmentAgent.roles.${e.key}.temperature`, n)
									})
								}), /* @__PURE__ */ (0, x.jsx)(N, {
									label: "Max tokens",
									children: /* @__PURE__ */ (0, x.jsx)(L, {
										type: "number",
										min: 100,
										max: 8e3,
										step: 100,
										value: r.maxTokens ?? 1200,
										onChange: (n) => t(`scheduleAssignmentAgent.roles.${e.key}.maxTokens`, n)
									})
								})]
							}), /* @__PURE__ */ (0, x.jsx)(B, {
								title: "עריכת פרומפט",
								children: /* @__PURE__ */ (0, x.jsx)(ee, {
									dir: "ltr",
									style: {
										textAlign: "left",
										fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace"
									},
									rows: 18,
									value: r.prompt || "",
									onChange: (n) => t(`scheduleAssignmentAgent.roles.${e.key}.prompt`, n)
								})
							})] })
						]
					}, e.key);
				})
			})] }),
			/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("p", {
				style: M.sectionTitle,
				children: "כלי חיפוש ומשקלי ציון"
			}), /* @__PURE__ */ (0, x.jsxs)("div", {
				style: {
					...M.card,
					display: "flex",
					flexDirection: "column",
					gap: 18
				},
				children: [
					/* @__PURE__ */ (0, x.jsx)("div", {
						style: {
							display: "grid",
							gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
							gap: 12
						},
						children: ye.map(([e, n]) => /* @__PURE__ */ (0, x.jsx)(z, {
							label: n,
							checked: i.tools?.[e] === !0,
							onChange: (n) => t(`scheduleAssignmentAgent.tools.${e}`, n)
						}, e))
					}),
					/* @__PURE__ */ (0, x.jsxs)("div", {
						style: {
							borderTop: "1px solid var(--line)",
							paddingTop: 16
						},
						children: [/* @__PURE__ */ (0, x.jsxs)("div", {
							style: {
								display: "flex",
								justifyContent: "space-between",
								gap: 12,
								marginBottom: 10
							},
							children: [/* @__PURE__ */ (0, x.jsx)("strong", {
								style: { fontSize: 13 },
								children: "משקלים"
							}), /* @__PURE__ */ (0, x.jsxs)("span", {
								style: {
									fontSize: 12,
									color: l === 100 ? "var(--success-text)" : "var(--error-text)"
								},
								children: [
									"סה״כ ",
									l,
									"% ",
									l === 100 ? "✓" : "— נדרש 100%"
								]
							})]
						}), /* @__PURE__ */ (0, x.jsx)("div", {
							style: M.grid3,
							children: be.map(([e, n]) => /* @__PURE__ */ (0, x.jsx)(N, {
								label: `${n} (%)`,
								children: /* @__PURE__ */ (0, x.jsx)(L, {
									type: "number",
									min: 0,
									max: 100,
									value: i.weights?.[e] ?? 0,
									onChange: (n) => t(`scheduleAssignmentAgent.weights.${e}`, n)
								})
							}, e))
						})]
					}),
					/* @__PURE__ */ (0, x.jsx)(we, {
						onClick: d,
						children: "בדוק הגדרה"
					}),
					a ? /* @__PURE__ */ (0, x.jsxs)("div", {
						role: "status",
						style: {
							fontSize: 12.5,
							lineHeight: 1.7,
							color: a.ok ? "var(--success-text)" : "var(--error-text)"
						},
						children: [a.ok ? "ההגדרה תקינה." : (a.errors || []).join(" "), (a.warnings || []).map((e) => /* @__PURE__ */ (0, x.jsxs)("div", {
							style: { color: "var(--warning-text, #9a6700)" },
							children: ["⚠ ", e]
						}, e))]
					}) : null
				]
			})] }),
			/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("p", {
				style: M.sectionTitle,
				children: "מעבדת Dry-run"
			}), /* @__PURE__ */ (0, x.jsxs)("div", {
				style: {
					...M.card,
					display: "flex",
					flexDirection: "column",
					gap: 12
				},
				children: [
					/* @__PURE__ */ (0, x.jsx)(F, { children: "המעבדה משתמשת רק בהגדרה השמורה בשרת ולעולם אינה כותבת שיוך. שמור את הטיוטה לפני הבדיקה." }),
					/* @__PURE__ */ (0, x.jsxs)("div", {
						style: M.grid2,
						children: [/* @__PURE__ */ (0, x.jsx)(N, {
							label: "Project ID",
							children: /* @__PURE__ */ (0, x.jsx)(L, {
								value: s.projectId,
								onChange: (e) => c((t) => ({
									...t,
									projectId: e
								}))
							})
						}), /* @__PURE__ */ (0, x.jsx)(N, {
							label: "Alert source ID",
							children: /* @__PURE__ */ (0, x.jsx)(L, {
								value: s.sourceId,
								onChange: (e) => c((t) => ({
									...t,
									sourceId: e
								}))
							})
						})]
					}),
					/* @__PURE__ */ (0, x.jsx)(we, {
						variant: "primary",
						disabled: s.busy || !s.projectId.trim() || !s.sourceId.trim(),
						onClick: f,
						children: s.busy ? "מריץ…" : "הרץ ללא כתיבה"
					}),
					s.error ? /* @__PURE__ */ (0, x.jsx)("div", {
						style: {
							color: "var(--error-text)",
							fontSize: 12.5
						},
						children: s.error
					}) : null,
					s.result ? /* @__PURE__ */ (0, x.jsxs)("div", {
						role: "status",
						style: {
							background: "var(--surface-2)",
							border: "1px solid var(--line)",
							borderRadius: "var(--r)",
							padding: 12,
							fontSize: 12.5,
							lineHeight: 1.7
						},
						children: [
							/* @__PURE__ */ (0, x.jsx)("strong", { children: s.result.decision?.selectedActivityName || "לא נמצאה פעילות חד־משמעית" }),
							/* @__PURE__ */ (0, x.jsxs)("div", { children: [
								"ציון התאמה: ",
								s.result.decision?.rankingScore ?? s.result.decision?.confidence ?? 0,
								` · פער: ${s.result.decision?.rankingGap ?? s.result.decision?.margin ?? 0}`,
								Number.isFinite(s.result.decision?.calibratedProbability) ? ` · הסתברות מכוילת: ${Math.round(s.result.decision.calibratedProbability * 100)}%` : "",
								` · החלטה: ${s.result.decision?.type}`
							] }),
							/* @__PURE__ */ (0, x.jsx)("div", { children: s.result.decision?.reason })
						]
					}) : null
				]
			})] })
		]
	});
}
function Ce(e = "secondary", t = !1) {
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
function we({ variant: e = "secondary", disabled: t = !1, onClick: n, children: r, title: i, style: a }) {
	let [o, s] = (0, b.useState)(!1), c = Ce(e, t), l = !t && o ? e === "primary" ? {
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
function Te({ sec: e, isActive: t, onSelect: n }) {
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
			/* @__PURE__ */ (0, x.jsx)(A, {
				path: j[e.id] || j.general,
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
function Ee({ active: e, onSelect: t }) {
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
		children: S.map((n) => /* @__PURE__ */ (0, x.jsx)(Te, {
			sec: n,
			isActive: n.id === e,
			onSelect: t
		}, n.id))
	});
}
function De({ saveState: e, onSave: t, onReload: n, onExport: r, onImport: i, fileRef: a }) {
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
					children: [/* @__PURE__ */ (0, x.jsx)(A, {
						path: j.check,
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
					children: [/* @__PURE__ */ (0, x.jsx)(A, {
						path: j.warning,
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
				/* @__PURE__ */ (0, x.jsxs)(we, {
					onClick: n,
					title: "רענן מ-Supabase",
					children: [/* @__PURE__ */ (0, x.jsx)(A, {
						path: j.reload,
						size: 14
					}), " רענן"]
				}),
				/* @__PURE__ */ (0, x.jsxs)(we, {
					onClick: r,
					title: "הורד קובץ הגדרות",
					children: [/* @__PURE__ */ (0, x.jsx)(A, {
						path: j.download,
						size: 14
					}), " ייצוא"]
				}),
				/* @__PURE__ */ (0, x.jsxs)("label", {
					style: {
						...Ce("secondary"),
						cursor: "pointer"
					},
					title: "טען קובץ הגדרות",
					children: [
						/* @__PURE__ */ (0, x.jsx)(A, {
							path: j.upload,
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
				/* @__PURE__ */ (0, x.jsxs)(we, {
					variant: "primary",
					onClick: t,
					disabled: o,
					children: [/* @__PURE__ */ (0, x.jsx)(A, {
						path: j.save,
						size: 14
					}), o ? "שומר..." : "שמור"]
				})
			]
		})]
	});
}
function Oe({ label: e, ok: t, detail: n }) {
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
function ke({ configStatus: e, form: t, saveState: n }) {
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
			/* @__PURE__ */ (0, x.jsx)(Oe, {
				label: "OpenRouter",
				ok: e.openRouter
			}),
			/* @__PURE__ */ (0, x.jsx)(Ae, {}),
			/* @__PURE__ */ (0, x.jsx)(Oe, {
				label: "App DB",
				ok: e.supabase
			}),
			/* @__PURE__ */ (0, x.jsx)(Ae, {}),
			/* @__PURE__ */ (0, x.jsx)(Oe, {
				label: "APP DATA",
				ok: e.contentSupabase,
				detail: i
			}),
			r.hybridRpcName && /* @__PURE__ */ (0, x.jsxs)(x.Fragment, { children: [/* @__PURE__ */ (0, x.jsx)(Ae, {}), /* @__PURE__ */ (0, x.jsx)(Oe, {
				label: "Content RPC",
				detail: r.hybridRpcName
			})] }),
			(r.indexTable || r.alertsTable) && /* @__PURE__ */ (0, x.jsxs)(x.Fragment, { children: [/* @__PURE__ */ (0, x.jsx)(Ae, {}), /* @__PURE__ */ (0, x.jsx)(Oe, {
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
function Ae() {
	return /* @__PURE__ */ (0, x.jsx)("span", {
		style: {
			color: "var(--line-strong, #cbd5e1)",
			margin: "0 8px"
		},
		children: "|"
	});
}
function je() {
	let [e, t] = (0, b.useState)({}), [n, r] = (0, b.useState)([]), [i, a] = (0, b.useState)(!0), [o, s] = (0, b.useState)("connections"), [c, l] = (0, b.useState)("idle"), [u, d] = (0, b.useState)({}), [f, p] = (0, b.useState)(""), [m, h] = (0, b.useState)({
		persisted: !1,
		snapshotId: ""
	}), g = (0, b.useRef)(null);
	(0, b.useEffect)(() => {
		Promise.all([
			E("/api/settings").catch(() => null),
			E("/api/openrouter/models").catch(() => ({ models: [] })),
			E("/api/settings/schedule-assignment-agent").catch(() => null)
		]).then(([e, n, i]) => {
			let o = e?.settings ?? e, s = o ? {
				...o,
				...i?.settings ? { scheduleAssignmentAgent: i.settings } : {}
			} : null;
			s && (t(O(s)), h({
				persisted: i?.persisted === !0,
				snapshotId: i?.snapshotId || o?.scheduleAssignmentAgent?.snapshotId || ""
			}), d({
				openRouter: s.openRouterConfigured,
				supabase: s.supabaseConfigured,
				contentSupabase: s.contentSupabaseConfigured
			})), r(n?.models || []), a(!1);
		});
	}, []);
	let _ = (0, b.useCallback)((e, n) => {
		t((t) => D(t, e, n)), l("idle");
	}, []), v = async () => {
		l("saving");
		try {
			let n = await E("/api/settings", {
				method: "PUT",
				body: k(e)
			});
			if (n?.settings) {
				d({
					openRouter: n.settings.openRouterConfigured,
					supabase: n.settings.supabaseConfigured,
					contentSupabase: n.settings.contentSupabaseConfigured
				});
				let e = await E("/api/settings/schedule-assignment-agent").catch(() => null);
				e?.settings && (t(O({
					...n.settings,
					scheduleAssignmentAgent: e.settings
				})), h({
					persisted: e.persisted === !0,
					snapshotId: e.snapshotId || ""
				}));
			}
			l("saved"), setTimeout(() => l("idle"), 3e3);
		} catch {
			l("error");
		}
	}, y = async () => {
		try {
			let e = await E("/api/settings/reload", {
				method: "POST",
				body: {}
			});
			if (e?.settings) {
				let n = await E("/api/settings/schedule-assignment-agent").catch(() => null);
				t(O({
					...e.settings,
					...n?.settings ? { scheduleAssignmentAgent: n.settings } : {}
				})), h({
					persisted: n?.persisted === !0,
					snapshotId: n?.snapshotId || e.settings.scheduleAssignmentAgent?.snapshotId || ""
				}), d({
					openRouter: e.settings.openRouterConfigured,
					supabase: e.settings.supabaseConfigured,
					contentSupabase: e.settings.contentSupabaseConfigured
				}), l("saved"), setTimeout(() => l("idle"), 2e3);
			}
		} catch {}
	}, S = async () => {
		try {
			let e = await E("/api/settings/export"), t = new Blob([JSON.stringify(e, null, 2)], { type: "application/json" }), n = document.createElement("a");
			n.href = URL.createObjectURL(t), n.download = "bidoc-settings.json", n.click();
		} catch {}
	}, C = async (e) => {
		let n = e.target.files?.[0];
		if (!n) return;
		let r = await n.text();
		try {
			let e = await E("/api/settings/import", {
				method: "POST",
				body: JSON.parse(r)
			});
			e?.settings && t(O(e.settings));
		} catch {}
		g.current && (g.current.value = "");
	}, w = async (e) => {
		try {
			let n = await E("/api/settings/preset/apply", {
				method: "POST",
				body: { name: e }
			});
			n?.settings && t(O(n.settings));
		} catch {}
	}, T = async (t) => {
		try {
			await E("/api/settings/preset", {
				method: "POST",
				body: {
					name: t,
					settings: k(e)
				}
			});
		} catch {}
	}, A = async () => {
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
	let j = {
		form: e,
		update: _,
		models: n,
		configStatus: u,
		scheduleAgentMeta: m
	};
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		dir: "rtl",
		style: {
			fontFamily: "var(--font-display)",
			color: "var(--text-primary)"
		},
		children: [
			/* @__PURE__ */ (0, x.jsx)("style", { children: "\n        @keyframes bidocFade { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }\n        @media (prefers-reduced-motion: reduce) {\n          [data-react-island=\"settings\"] * { animation-duration: .001ms !important; transition-duration: .001ms !important; }\n        }\n        @media (max-width: 720px) {\n          [data-bidoc-settings-layout] { flex-direction: column !important; }\n          [data-bidoc-settings-layout] > nav { width: 100% !important; flex-direction: row !important; overflow-x: auto; }\n        }\n      " }),
			/* @__PURE__ */ (0, x.jsx)(De, {
				saveState: c,
				onSave: v,
				onReload: y,
				onExport: S,
				onImport: C,
				fileRef: g
			}),
			/* @__PURE__ */ (0, x.jsx)(ke, {
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
				children: [/* @__PURE__ */ (0, x.jsx)(Ee, {
					active: o,
					onSelect: s
				}), /* @__PURE__ */ (0, x.jsxs)("div", {
					style: {
						flex: 1,
						minWidth: 0,
						animation: "bidocFade .18s ease-out"
					},
					children: [
						o === "connections" && /* @__PURE__ */ (0, x.jsx)(re, { ...j }),
						o === "agents" && /* @__PURE__ */ (0, x.jsx)(ae, {
							...j,
							onRefreshModels: A,
							modelStatus: f
						}),
						o === "contractsAgent" && /* @__PURE__ */ (0, x.jsx)(ce, { ...j }),
						o === "scheduleAgent" && /* @__PURE__ */ (0, x.jsx)(Se, { ...j }),
						o === "retrieval" && /* @__PURE__ */ (0, x.jsx)(le, { ...j }),
						o === "content" && /* @__PURE__ */ (0, x.jsx)(ue, { ...j }),
						o === "tools" && /* @__PURE__ */ (0, x.jsx)(de, { ...j }),
						o === "memory" && /* @__PURE__ */ (0, x.jsx)(fe, { ...j }),
						o === "performance" && /* @__PURE__ */ (0, x.jsx)(he, { ...j }),
						o === "presets" && /* @__PURE__ */ (0, x.jsx)(ge, {
							...j,
							onApplyPreset: w,
							onSavePreset: T
						}),
						o === "general" && /* @__PURE__ */ (0, x.jsx)(_e, { ...j })
					]
				}, o)]
			})
		]
	});
}
//#endregion
//#region src/react/WorkflowPage.jsx
var Me = ({ path: e, size: t = 16, strokeWidth: n = 2, ...r }) => /* @__PURE__ */ (0, x.jsx)("svg", {
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
}), U = {
	report: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8",
	log: "M4 6h16M4 12h16M4 18h10",
	copy: "M9 9h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2zM5 15H4a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1",
	clear: "M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
}, Ne = [
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
], Pe = [
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
function Fe({ m: e }) {
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		className: "metricCard",
		id: `metricCard_${e.id}`,
		children: [/* @__PURE__ */ (0, x.jsx)("span", {
			className: "metricIcon",
			children: /* @__PURE__ */ (0, x.jsx)(Me, {
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
function Ie() {
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
						children: [/* @__PURE__ */ (0, x.jsx)(Me, {
							path: U.report,
							size: 15
						}), " דוח AI"]
					}),
					/* @__PURE__ */ (0, x.jsxs)("button", {
						id: "toggleFullLog",
						type: "button",
						className: "wfBtn",
						children: [/* @__PURE__ */ (0, x.jsx)(Me, {
							path: U.log,
							size: 15
						}), " לוג מלא"]
					}),
					/* @__PURE__ */ (0, x.jsxs)("button", {
						id: "copyLog",
						type: "button",
						className: "wfBtn",
						children: [/* @__PURE__ */ (0, x.jsx)(Me, {
							path: U.copy,
							size: 15
						}), " העתק"]
					}),
					/* @__PURE__ */ (0, x.jsxs)("button", {
						id: "clearWorkflow",
						type: "button",
						className: "wfBtn wfBtnDanger",
						children: [/* @__PURE__ */ (0, x.jsx)(Me, {
							path: U.clear,
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
						children: Ne.map((e) => /* @__PURE__ */ (0, x.jsx)(Fe, { m: e }, e.id))
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
								children: Pe.map((e, t) => /* @__PURE__ */ (0, x.jsx)("button", {
									className: `bottomTab${t === 0 ? " active" : ""}`,
									"data-bottom-tab": e.id,
									children: e.label
								}, e.id))
							}), /* @__PURE__ */ (0, x.jsxs)("button", {
								id: "wfExportBtn",
								className: "wfExportBtn",
								type: "button",
								children: [/* @__PURE__ */ (0, x.jsx)(Me, {
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
var Le = "2024-02-01", Re = "2026-01-01", ze = 350, Be = ({ path: e, size: t = 16, strokeWidth: n = 2, ...r }) => /* @__PURE__ */ (0, x.jsx)("svg", {
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
}), Ve = {
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
async function He(e, t = {}) {
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
function Ue(e) {
	return [...new Set((e || []).filter(Boolean))];
}
function We(e = {}, t = !1) {
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
function Ge(e = {}) {
	let t = Array.isArray(e.insights) ? e.insights : [];
	return t.length ? Array.isArray(e.findings) || Array.isArray(e.metadata?.findings) ? t : t.filter((e) => Array.isArray(e?.supporting_finding_ids) && e.supporting_finding_ids.length) : [];
}
function Ke(e, t) {
	if (!e || e.ok === !1) return t;
	let n = We(e, !0), r = We(t), i = Ge(e), a = Ge(t);
	return {
		...t,
		summary: {
			...t.summary || {},
			totalRecords: Number(e.summary?.totalRecords || 0) + Number(t.summary?.totalRecords || 0),
			expandedRuns: Number(e.summary?.expandedRuns || 1) + 1
		},
		findings: qe([...n, ...r]),
		insights: qe([...i, ...a]),
		workflowLog: t.workflowLog || e.workflowLog
	};
}
function qe(e = []) {
	let t = /* @__PURE__ */ new Set(), n = [];
	for (let r of e) {
		let e = String(r.id || r.title || r.finding || r.insight || JSON.stringify(r)).slice(0, 180);
		t.has(e) || (t.add(e), n.push(r));
	}
	return n;
}
function Je(e = {}) {
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
		insights: Ge(n),
		findings: We(n, !0),
		workflowLog: e.workflow_log || t.workflowLog || null,
		scannedSourceKeys: e.scanned_source_keys || t.scannedSourceKeys || [],
		healthScore: t.healthScore || e.healthScore,
		trends: t.trends || e.trends,
		rootCauseHypotheses: t.rootCauseHypotheses || e.rootCauseHypotheses
	};
}
function Ye(e) {
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
function Xe(e) {
	return {
		high: "גבוה",
		medium: "בינוני",
		low: "נמוך"
	}[e] || e || "בינוני";
}
function Ze(e) {
	if (!e) return "";
	let t = Date.now() - new Date(e).getTime();
	if (!Number.isFinite(t)) return "";
	let n = Math.max(1, Math.round(t / 6e4));
	if (n < 60) return `לפני ${n} דק׳`;
	let r = Math.round(n / 60);
	return r < 24 ? `לפני ${r} שעות` : `לפני ${Math.round(r / 24)} ימים`;
}
function Qe(e = {}) {
	let t = e.evidence || e.sources || e.records || e.evidence_records || [];
	return Array.isArray(t) ? t.slice(0, 5) : [];
}
function $e() {
	let [e, t] = (0, b.useState)(""), [n, r] = (0, b.useState)(Le), [i, a] = (0, b.useState)(Re), [o, s] = (0, b.useState)(ze), [c, l] = (0, b.useState)({
		crossWindowTrend: !1,
		rootCauseHypotheses: !1,
		healthScore: !1,
		graphClustering: !1
	}), [u, d] = (0, b.useState)("alerts"), [f, p] = (0, b.useState)(!1), [m, h] = (0, b.useState)([]), [g, _] = (0, b.useState)([]), [v, y] = (0, b.useState)([]), [S, C] = (0, b.useState)(!1), [w, T] = (0, b.useState)(""), [E, D] = (0, b.useState)(null), [O, k] = (0, b.useState)(!1), [A, j] = (0, b.useState)({
		state: "idle",
		text: "מוכן להרצת סוכן התובנות"
	}), [M, N] = (0, b.useState)([]), [P, F] = (0, b.useState)([]), [I, L] = (0, b.useState)(0), R = (0, b.useRef)(null), z = (0, b.useRef)(null), ee = (0, b.useMemo)(() => {
		let e = m.slice(0, 30);
		return f ? [...e].sort((e, t) => String(e.tag).localeCompare(String(t.tag), "he")) : e;
	}, [m, f]), te = (0, b.useMemo)(() => Math.max(...ee.map((e) => Number(e.count || 0)), 1), [ee]), B = (0, b.useMemo)(() => Ge(E || {}), [E]), V = (0, b.useMemo)(() => We(E || {}, !0), [E]), ne = !!(E && E.ok !== !1 && (P.length || E.scannedSourceKeys?.length)), re = (0, b.useCallback)(async (e = {}) => {
		let t = e.source || u, r = new URLSearchParams();
		n && r.set("date_from", n), i && r.set("date_to", i), r.set("source", t);
		let a = await He(`/api/insights/hashtags?${r}`, { timeoutMs: 15e3 });
		h(Array.isArray(a.hashtags) ? a.hashtags : []), d(t);
	}, [
		u,
		n,
		i
	]), ie = (0, b.useCallback)(async () => {
		let e = await He("/api/insights/runs?limit=30", { timeoutMs: 2e4 });
		y(Array.isArray(e.runs) ? e.runs : []);
	}, []);
	(0, b.useEffect)(() => {
		re().catch((e) => j({
			state: "error",
			text: `לא ניתן לטעון האשטגים: ${e.message}`
		}));
	}, [re]), (0, b.useEffect)(() => {
		ie().catch(() => {});
	}, [ie]), (0, b.useEffect)(() => () => {
		R.current && R.current.close();
	}, []);
	function ae(e) {
		l((t) => ({
			...t,
			[e]: !t[e]
		}));
	}
	function oe(e) {
		_((t) => t.includes(e) ? t.filter((t) => t !== e) : [...t, e]);
	}
	function se(e) {
		R.current && R.current.close(), N([]);
		try {
			let t = new EventSource(`/api/runs/${encodeURIComponent(e)}/events`);
			t.addEventListener("log", (e) => {
				try {
					let t = JSON.parse(e.data);
					if (t.step === "complete" || t.step === "error") return;
					let n = ft(t);
					N((e) => e[e.length - 1] === n ? e : [...e, n]);
				} catch {}
			}), t.onerror = () => {}, R.current = t;
		} catch {
			R.current = null;
		}
	}
	async function ce({ expansion: t = !1 } = {}) {
		if (O) return;
		k(!0);
		let r = t ? P : [], a = `project_insights_${Date.now()}_${Math.random().toString(16).slice(2)}`;
		j({
			state: "running",
			text: t ? `מרחיב תשובה ומדלג על ${r.length.toLocaleString()} מקורות שכבר נותחו...` : "מריץ ניתוח על נתוני האינדקס..."
		}), t || (D(null), F([]), L(0), T("")), se(a);
		try {
			let s = await He("/api/insights/analyze", {
				method: "POST",
				timeoutMs: 9e5,
				body: {
					runId: a,
					focusQuery: e,
					dateFrom: n || null,
					dateTo: i || null,
					limit: Number(o || ze),
					selectedHashtags: g,
					hashtagMode: "boost",
					insights: Object.fromEntries(Object.entries(c).filter(([, e]) => e)),
					excludeSourceKeys: r,
					expansion: t,
					parentRunId: t && (E?.runId || w) || null
				}
			}), l = t ? Ke(E, s) : s;
			D(l), F((e) => Ue([...e, ...s.scannedSourceKeys || []])), L((e) => e + 1), T(l?.runId || s.runId || ""), j({
				state: "done",
				text: "ניתוח התובנות הסתיים"
			}), window.__bidocSetWorkflowFromReact?.(s), await ie().catch(() => {}), setTimeout(() => z.current?.scrollIntoView({
				behavior: "smooth",
				block: "start"
			}), 120);
		} catch (e) {
			D(t && E ? {
				...E,
				expansionError: e.message
			} : {
				ok: !1,
				error: e.message
			}), j({
				state: "error",
				text: `ניתוח התובנות נכשל: ${e.message}`
			});
		} finally {
			R.current && R.current.close(), R.current = null, k(!1);
		}
	}
	function le(e) {
		let n = Je(e);
		D(n), T(n.runId), F(Array.isArray(e.scanned_source_keys) ? e.scanned_source_keys : n.scannedSourceKeys || []), L(Number(n.summary?.expandedRuns || e.metadata?.runCount || (e.is_expansion ? 2 : 1) || 1)), t(e.focus_query || n.summary?.focusQuery || ""), (e.date_from || n.summary?.dateFrom) && r(e.date_from || n.summary.dateFrom), (e.date_to || n.summary?.dateTo) && a(e.date_to || n.summary.dateTo), e.source_limit && s(Number(e.source_limit)), j({
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
							children: [/* @__PURE__ */ (0, x.jsx)(Be, {
								path: Ve.spark,
								size: 14
							}), " Project Intelligence"]
						}),
						/* @__PURE__ */ (0, x.jsx)("h2", { children: "סוכן תובנות" }),
						/* @__PURE__ */ (0, x.jsx)("p", { children: "מסך עבודה לריצות עומק על אינדקס הפרויקט: איתור חסמים, החלטות פתוחות, ישויות משפיעות, מגמות וסיכונים עם ראיות." })
					]
				}), /* @__PURE__ */ (0, x.jsxs)("div", {
					className: "riHeroStats",
					children: [
						/* @__PURE__ */ (0, x.jsx)(et, {
							label: "ריצות שמורות",
							value: v.length || "0"
						}),
						/* @__PURE__ */ (0, x.jsx)(et, {
							label: "האשטגים פעילים",
							value: g.length || "0"
						}),
						/* @__PURE__ */ (0, x.jsx)(et, {
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
										e.key === "Enter" && (e.ctrlKey || e.metaKey) && (e.preventDefault(), ce({ expansion: e.shiftKey }));
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
							/* @__PURE__ */ (0, x.jsx)(tt, {
								checked: c.crossWindowTrend,
								onClick: () => ae("crossWindowTrend"),
								label: "מגמות"
							}),
							/* @__PURE__ */ (0, x.jsx)(tt, {
								checked: c.rootCauseHypotheses,
								onClick: () => ae("rootCauseHypotheses"),
								label: "סיבת שורש"
							}),
							/* @__PURE__ */ (0, x.jsx)(tt, {
								checked: c.healthScore,
								onClick: () => ae("healthScore"),
								label: "ציון בריאות"
							}),
							/* @__PURE__ */ (0, x.jsx)(tt, {
								checked: c.graphClustering,
								onClick: () => ae("graphClustering"),
								label: "גרף"
							})
						]
					}),
					/* @__PURE__ */ (0, x.jsxs)("div", {
						className: "riActionRow",
						children: [
							/* @__PURE__ */ (0, x.jsxs)("button", {
								className: "riBtn riBtnPrimary",
								disabled: O,
								onClick: () => ce(),
								children: [
									/* @__PURE__ */ (0, x.jsx)(Be, {
										path: Ve.play,
										size: 15
									}),
									" ",
									O ? "מנתח..." : "נתח את הפרויקט"
								]
							}),
							/* @__PURE__ */ (0, x.jsxs)("button", {
								className: "riBtn",
								disabled: O || !ne,
								onClick: () => ce({ expansion: !0 }),
								children: [/* @__PURE__ */ (0, x.jsx)(Be, {
									path: Ve.plus,
									size: 15
								}), " הרחב תשובה"]
							}),
							/* @__PURE__ */ (0, x.jsxs)("button", {
								className: "riBtn",
								onClick: () => re().catch((e) => j({
									state: "error",
									text: e.message
								})),
								children: [/* @__PURE__ */ (0, x.jsx)(Be, {
									path: Ve.refresh,
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
				children: [/* @__PURE__ */ (0, x.jsx)(nt, {
					hashtags: ee,
					max: te,
					selected: g,
					source: u,
					sortAlpha: f,
					onToggleTag: oe,
					onSource: (e) => re({ source: e }).catch((e) => j({
						state: "error",
						text: e.message
					})),
					onSort: p,
					onClear: () => _([])
				}), /* @__PURE__ */ (0, x.jsx)(rt, {
					history: v,
					open: S,
					selectedRunId: w,
					onToggle: () => C((e) => !e),
					onRefresh: () => ie().catch((e) => j({
						state: "error",
						text: e.message
					})),
					onSelect: le
				})]
			}),
			/* @__PURE__ */ (0, x.jsx)(W, {
				status: A,
				liveSteps: M,
				result: E,
				runCount: I,
				scannedKeys: P,
				insights: B,
				findings: V
			}),
			/* @__PURE__ */ (0, x.jsx)("section", {
				className: "riResults",
				ref: z,
				children: O && !E ? /* @__PURE__ */ (0, x.jsx)(dt, {}) : /* @__PURE__ */ (0, x.jsx)(G, {
					result: E,
					insights: B,
					findings: V
				})
			})
		]
	});
}
function et({ label: e, value: t }) {
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		className: "riMetric",
		children: [/* @__PURE__ */ (0, x.jsx)("span", { children: e }), /* @__PURE__ */ (0, x.jsx)("strong", { children: t })]
	});
}
function tt({ checked: e, onClick: t, label: n }) {
	return /* @__PURE__ */ (0, x.jsxs)("button", {
		type: "button",
		className: "riToggle",
		"aria-pressed": e,
		onClick: t,
		children: [/* @__PURE__ */ (0, x.jsx)("span", { "aria-hidden": "true" }), n]
	});
}
function nt({ hashtags: e, max: t, selected: n, source: r, sortAlpha: i, onToggleTag: a, onSource: o, onSort: s, onClear: c }) {
	return /* @__PURE__ */ (0, x.jsxs)("section", {
		className: "riPanel riHashtags",
		children: [
			/* @__PURE__ */ (0, x.jsxs)("header", { children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsxs)("span", {
				className: "riEyebrow",
				children: [/* @__PURE__ */ (0, x.jsx)(Be, {
					path: Ve.chart,
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
function rt({ history: e, open: t, selectedRunId: n, onToggle: r, onRefresh: i, onSelect: a }) {
	return /* @__PURE__ */ (0, x.jsxs)("section", {
		className: "riPanel riHistory",
		"data-open": t ? "true" : "false",
		children: [/* @__PURE__ */ (0, x.jsxs)("header", { children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsxs)("span", {
			className: "riEyebrow",
			children: [/* @__PURE__ */ (0, x.jsx)(Be, {
				path: Ve.history,
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
				let t = Je(e);
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
							Ze(e.created_at)
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
function W({ status: e, liveSteps: t, result: n, runCount: r, scannedKeys: i, insights: a, findings: o }) {
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
				children: [/* @__PURE__ */ (0, x.jsx)(Be, {
					path: Ve.workflow,
					size: 13
				}), " פתח Workflow"]
			}),
			!n && c > 0 && /* @__PURE__ */ (0, x.jsxs)("span", { children: [c.toLocaleString(), " מקורות נסרקו"] }),
			t.length > 0 && /* @__PURE__ */ (0, x.jsx)("div", {
				className: "riLiveSteps",
				children: t.slice(-7).map((e, n) => /* @__PURE__ */ (0, x.jsxs)("span", {
					className: n === t.slice(-7).length - 1 ? "active" : "done",
					children: [n === t.slice(-7).length - 1 ? /* @__PURE__ */ (0, x.jsx)("i", { className: "progressSpinner" }) : /* @__PURE__ */ (0, x.jsx)(Be, {
						path: Ve.check,
						size: 11
					}), e]
				}, `${e}_${n}`))
			})
		]
	});
}
function G({ result: e, insights: t, findings: n }) {
	if (!e) return /* @__PURE__ */ (0, x.jsxs)("div", {
		className: "riWelcome",
		children: [
			/* @__PURE__ */ (0, x.jsx)("span", { children: /* @__PURE__ */ (0, x.jsx)(Be, {
				path: Ve.spark,
				size: 22
			}) }),
			/* @__PURE__ */ (0, x.jsx)("h3", { children: "הרץ ניתוח AI על נתוני הפרויקט" }),
			/* @__PURE__ */ (0, x.jsx)("p", { children: "הסוכן יסרוק את האינדקס, יחבר ממצאים לדפוסים, ויציג תובנות עם פעולה מומלצת וראיות." })
		]
	});
	if (e.ok === !1) return /* @__PURE__ */ (0, x.jsxs)("div", {
		className: "riError",
		children: [
			/* @__PURE__ */ (0, x.jsx)(Be, {
				path: Ve.alert,
				size: 18
			}),
			" ",
			e.error || "ניתוח התובנות נכשל."
		]
	});
	let r = /* @__PURE__ */ (0, x.jsx)(it, { result: e });
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
				children: t.map((e, t) => /* @__PURE__ */ (0, x.jsx)(ct, {
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
				children: a.map((e, t) => /* @__PURE__ */ (0, x.jsx)(lt, { finding: e }, e.id || t))
			})]
		})
	] });
}
function it({ result: e }) {
	let t = [];
	return e.healthScore && t.push(/* @__PURE__ */ (0, x.jsx)(at, { health: e.healthScore }, "health")), Array.isArray(e.trends?.metrics) && e.trends.metrics.length && t.push(/* @__PURE__ */ (0, x.jsx)(ot, { trends: e.trends }, "trends")), Array.isArray(e.rootCauseHypotheses) && e.rootCauseHypotheses.length && t.push(/* @__PURE__ */ (0, x.jsx)(st, { hypotheses: e.rootCauseHypotheses }, "hypotheses")), t.length ? /* @__PURE__ */ (0, x.jsx)("section", {
		className: "riEnginePanels",
		children: t
	}) : null;
}
function at({ health: e = {} }) {
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
function ot({ trends: e = {} }) {
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
function st({ hypotheses: e = [] }) {
	return /* @__PURE__ */ (0, x.jsxs)("article", {
		className: "riEnginePanel",
		children: [/* @__PURE__ */ (0, x.jsxs)("header", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "Requires Validation" }), /* @__PURE__ */ (0, x.jsx)("h4", { children: "השערות סיבת שורש" })] }), /* @__PURE__ */ (0, x.jsx)("div", {
			className: "riHypotheses",
			children: e.slice(0, 4).map((e, t) => /* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("b", { children: e.title || e.hypothesis || "השערה לבדיקה" }), /* @__PURE__ */ (0, x.jsx)("p", { children: e.hypothesis || e.rationale || e.summary })] }, e.id || t))
		})]
	});
}
function ct({ insight: e, findings: t }) {
	let [n, r] = (0, b.useState)(!1), i = (e.supporting_finding_ids || []).map((e) => t.find((t) => String(t.id || "") === String(e))).filter(Boolean);
	return /* @__PURE__ */ (0, x.jsxs)("article", {
		className: "riInsightCard",
		"data-severity": e.severity || "medium",
		children: [
			/* @__PURE__ */ (0, x.jsxs)("header", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: Ye(e.category) }), /* @__PURE__ */ (0, x.jsx)("b", { children: Xe(e.severity) })] }),
			/* @__PURE__ */ (0, x.jsx)("h4", { children: e.title || "תובנה" }),
			/* @__PURE__ */ (0, x.jsx)("p", { children: e.insight || e.finding || e.summary }),
			e.why_it_matters && /* @__PURE__ */ (0, x.jsx)(ut, {
				title: "למה זה חשוב",
				text: e.why_it_matters
			}),
			e.recommended_action && /* @__PURE__ */ (0, x.jsx)(ut, {
				title: "פעולה מומלצת",
				text: e.recommended_action
			}),
			e.uncertainty && /* @__PURE__ */ (0, x.jsx)(ut, {
				title: "אי ודאות",
				text: e.uncertainty
			}),
			i.length > 0 && /* @__PURE__ */ (0, x.jsxs)("div", {
				className: "riSupporting",
				children: [/* @__PURE__ */ (0, x.jsxs)("button", {
					onClick: () => r((e) => !e),
					children: [
						/* @__PURE__ */ (0, x.jsx)(Be, {
							path: Ve.chevron,
							size: 13
						}),
						" ",
						n ? "הסתר ממצאים" : `${i.length} ממצאים תומכים`
					]
				}), n && i.map((e, t) => /* @__PURE__ */ (0, x.jsx)(lt, {
					finding: e,
					compact: !0
				}, e.id || t))]
			})
		]
	});
}
function lt({ finding: e, compact: t = !1 }) {
	let n = Qe(e);
	return /* @__PURE__ */ (0, x.jsxs)("article", {
		className: "riFindingCard",
		"data-compact": t ? "true" : "false",
		"data-severity": e.severity || "medium",
		children: [
			/* @__PURE__ */ (0, x.jsxs)("header", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: Ye(e.category) }), /* @__PURE__ */ (0, x.jsx)("b", { children: Xe(e.severity) })] }),
			/* @__PURE__ */ (0, x.jsx)("h4", { children: e.title || "ממצא" }),
			/* @__PURE__ */ (0, x.jsx)("p", { children: e.finding || e.insight || e.summary }),
			!t && e.recommended_action && /* @__PURE__ */ (0, x.jsx)(ut, {
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
function ut({ title: e, text: t }) {
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		className: "riInfoLine",
		children: [/* @__PURE__ */ (0, x.jsx)("b", { children: e }), /* @__PURE__ */ (0, x.jsx)("span", { children: t })]
	});
}
function dt() {
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
function ft(e = {}) {
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
//#region src/react/scheduleTimeline.js
var pt = 1440 * 60 * 1e3, mt = Object.freeze({
	view: "axes",
	onlyLate: !1,
	showLateLines: !1,
	showAsOfMarker: !1,
	alertsOpen: !1,
	conditionsOpen: !1
});
function ht(e) {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(String(e ?? ""))) return null;
	let t = Date.parse(`${e}T00:00:00Z`);
	return Number.isNaN(t) ? null : t;
}
function gt(e) {
	let t = String(e ?? "").trim().match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/u);
	if (!t) return null;
	let n = Number(t[1]), r = Number(t[2]), i = Number(t[3]), a = new Date(Date.UTC(i, r - 1, n));
	return a.getUTCFullYear() !== i || a.getUTCMonth() !== r - 1 || a.getUTCDate() !== n ? null : `${String(i).padStart(4, "0")}-${String(r).padStart(2, "0")}-${String(n).padStart(2, "0")}`;
}
function _t(e) {
	let t = String(e ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/u);
	return t ? `${t[3]}/${t[2]}/${t[1]}` : String(e ?? "");
}
function vt(e = [], t, n = e) {
	let r = Infinity, i = -Infinity, a = (e) => {
		let t = ht(e);
		t != null && (t < r && (r = t), t > i && (i = t));
	};
	a(t);
	for (let t of e) {
		let e = t?.timing ?? {};
		a(e.plannedStart), a(e.plannedFinish), a(e.contractFinish), a(e.observedStart), a(e.observedFinish);
	}
	for (let e of n ?? []) a(e?.timing?.contractFinish);
	if (!Number.isFinite(r) || !Number.isFinite(i)) return null;
	if (r === i) r -= pt, i += pt;
	else {
		let e = (i - r) * .03;
		r -= e, i += e;
	}
	let o = (e) => {
		let t = ht(e);
		return t == null ? null : Math.min(100, Math.max(0, (t - r) / (i - r) * 100));
	}, s = [], c = new Date(r);
	for (c.setUTCDate(1); c.getTime() <= i;) {
		let e = c.toISOString().slice(0, 10), t = o(e);
		t != null && s.push({
			iso: e,
			left: t,
			month: c.getUTCMonth(),
			year: c.getUTCFullYear()
		}), c.setUTCMonth(c.getUTCMonth() + 1);
	}
	return {
		pos: o,
		months: s
	};
}
function yt(e) {
	let t = e?.subject ?? {};
	return t.activityKey || (t.milestoneKey ? `milestone:${t.milestoneKey}` : null);
}
//#endregion
//#region src/react/activityAssignmentBatch.js
var bt = Object.freeze({
	IDLE: "idle",
	RUNNING: "running",
	STOPPING: "stopping",
	PAUSED: "paused",
	COMPLETED: "completed"
}), xt = Object.freeze([
	10,
	25,
	50
]), St = xt[0], Ct = Object.freeze({
	manual: Object.freeze({
		key: "manual",
		label: "שויך ידנית"
	}),
	agent_approved: Object.freeze({
		key: "agent-approved",
		label: "הוצע על ידי הסוכן ואושר"
	}),
	agent_auto: Object.freeze({
		key: "agent-auto",
		label: "שויך אוטומטית"
	}),
	existing: Object.freeze({
		key: "existing",
		label: "שיוך קיים"
	})
}), wt = Object.freeze({
	query: "",
	kind: "",
	dateFrom: "",
	dateTo: "",
	text: "",
	severity: "",
	status: "",
	assignmentState: "",
	activity: ""
});
function Tt(e) {
	return String(e ?? "").trim().toLocaleLowerCase("he");
}
function Et(e = {}) {
	return Object.keys(wt).some((t) => Tt(e[t]));
}
function Dt(e = [], t = [], n = {}) {
	let r = {
		...wt,
		...n
	}, i = new Map((Array.isArray(t) ? t : []).map((e) => [String(e?.key || ""), e?.name || ""])), a = Tt(r.query), o = Tt(r.text), s = Tt(r.activity);
	return (Array.isArray(e) ? e : []).filter((e) => {
		let t = String(e?.activityKey || ""), n = i.get(t) || "", c = String(e?.date || ""), l = Tt(`${e?.title || ""} ${e?.alertType || ""}`), u = Tt([
			e?.kind === "update" ? "עדכון" : "התראה",
			c,
			e?.title,
			e?.alertType,
			e?.severity,
			e?.status,
			n
		].join(" "));
		return !(a && !u.includes(a) || r.kind && e?.kind !== r.kind || r.dateFrom && (!c || c < r.dateFrom) || r.dateTo && (!c || c > r.dateTo) || o && !l.includes(o) || r.severity !== "" && String(e?.severity ?? "") !== String(r.severity) || r.status !== "" && String(e?.status || "") !== String(r.status) || r.assignmentState === "assigned" && !t || r.assignmentState === "unassigned" && t || s && !Tt(n).includes(s));
	});
}
function Ot(e = {}) {
	return {
		status: bt.IDLE,
		queue: [],
		nextIndex: 0,
		processed: 0,
		total: 0,
		assigned: 0,
		review: 0,
		skipped: 0,
		failed: 0,
		currentId: null,
		timeFilter: !1,
		...e
	};
}
function kt(e) {
	let t = Number(e);
	return xt.includes(t) ? t : St;
}
function At(e = [], { limit: t = Infinity, excludedSourceIds: n = [] } = {}) {
	let r = Number.isFinite(Number(t)) ? Math.max(0, Math.floor(Number(t))) : Infinity;
	if (r === 0) return [];
	let i = new Set((Array.isArray(n) ? n : []).map((e) => String(e || "").trim()).filter(Boolean)), a = /* @__PURE__ */ new Set(), o = [];
	for (let t of Array.isArray(e) ? e : []) {
		let e = String(t?.id || "").trim();
		if (!(!e || !t?.date || t?.activityKey || a.has(e) || i.has(e)) && (a.add(e), o.push(t), o.length >= r)) break;
	}
	return o;
}
function jt({ batchSize: e = 0, eligibleCount: t = 0 } = {}) {
	return [
		`המערכת תבדוק ${Number(e) || 0} מתוך ${Number(t) || 0} ההתראות הלא משויכות.`,
		"הריצה הקבוצתית היא במצב בדיקה בלבד ואינה כותבת שיוכים אוטומטיים.",
		"תוצאות לא ודאיות יישמרו להחלטה אנושית. להמשיך?"
	].join("\n\n");
}
function Mt(e = {}) {
	return e?.activityKey ? Ct[e.assignmentMethod] || Ct.existing : null;
}
function Nt(e, t = 2) {
	if (!e || e.status === "filtered_out" || e.decision?.autoAssigned) return [];
	let n = Math.max(0, Math.min(2, Number(t) || 0));
	return (Array.isArray(e.candidates) ? e.candidates : []).filter((e) => e?.activityKey && e?.name).slice(0, n);
}
function Pt(e = {}, t = {}) {
	return {
		alertTitle: String(e?.title || t?.event?.title || "").trim() || "התראה ללא כותרת",
		recommendation: t?.decision?.autoAssigned ? "שויך אוטומטית" : String(t?.decision?.selectedActivityName || "").trim() || "לא נמצאה התאמה חד-משמעית"
	};
}
function Ft(e, t) {
	let n = {
		processed: Number(e?.processed) || 0,
		assigned: Number(e?.assigned) || 0,
		review: Number(e?.review) || 0,
		skipped: Number(e?.skipped) || 0,
		failed: Number(e?.failed) || 0
	};
	return n.processed += 1, t?.ok ? t.result?.status === "filtered_out" || t.result?.timeFilter?.skipped === !0 ? n.skipped += 1 : t.result?.assignment ? n.assigned += 1 : n.review += 1 : n.failed += 1, n;
}
function It(e) {
	let t = Number(e?.processed) || 0, n = Number(e?.total) || 0;
	switch (e?.status) {
		case bt.RUNNING: return `${e?.timeFilter ? "מסנן ובודק" : "בודק"} שורה ${Math.min(t + 1, n)} מתוך ${n}`;
		case bt.STOPPING: return "בקשת העצירה נקלטה - מסיים את השורה הפעילה";
		case bt.PAUSED: return `הריצה נעצרה אחרי ${t} מתוך ${n}`;
		case bt.COMPLETED: return `הריצה הסתיימה: ${t} נבדקו · ${e.assigned || 0} שויכו · ${e.review || 0} הועברו להחלטה · ${e.skipped || 0} דולגו · ${e.failed || 0} נכשלו`;
		default: return "";
	}
}
//#endregion
//#region src/scheduleActivityAssignmentLabels.js
var Lt = Object.freeze({
	CONFIRMED_MATCH: "confirmed_match",
	REJECTED_MATCH: "rejected_match",
	NO_MATCH: "no_match",
	STALE_ACTIVITY: "stale_activity",
	IRRELEVANT_ALERT: "irrelevant_alert",
	AMBIGUOUS: "ambiguous"
}), Rt = Object.freeze([
	Lt.REJECTED_MATCH,
	Lt.NO_MATCH,
	Lt.STALE_ACTIVITY,
	Lt.IRRELEVANT_ALERT,
	Lt.AMBIGUOUS
]);
Object.freeze([
	Lt.CONFIRMED_MATCH,
	Lt.REJECTED_MATCH,
	Lt.NO_MATCH,
	Lt.IRRELEVANT_ALERT,
	Lt.AMBIGUOUS
]);
var zt = Object.freeze([
	{
		type: Lt.NO_MATCH,
		labelHe: "אף פעילות אינה מתאימה",
		reasonHe: "הבודק אישר שאין פעילות מתאימה בגרסת לוח הזמנים הפעילה."
	},
	{
		type: Lt.AMBIGUOUS,
		labelHe: "אין מספיק מידע להכריע",
		reasonHe: "הבודק אישר שכמה פעילויות נותרו סבירות ואין די מידע להכרעה."
	},
	{
		type: Lt.IRRELEVANT_ALERT,
		labelHe: "לא רלוונטי לשיוך בלוח",
		reasonHe: "הבודק אישר שההתראה אינה צריכה להיכנס לתהליך שיוך הפעילויות."
	},
	{
		type: Lt.REJECTED_MATCH,
		labelHe: "ההצעות שגויות. קיימת פעילות אחרת",
		reasonHe: "הבודק דחה את הפעילויות שהוצעו אך לא קבע שאין פעילות מתאימה אחרת."
	}
]);
new Set(Object.values(Lt)), new Set(Rt);
//#endregion
//#region src/react/scheduleActivityAssignmentReviewState.js
function Bt(e) {
	return String(e ?? "").trim();
}
function Vt(e = {}) {
	let t = e.event && typeof e.event == "object" ? e.event : {}, n = Bt(e.sourceId || t.id), r = Bt(t.alertType) || "החלטת צוות";
	return {
		id: n,
		sourceEventId: `alert_${n}`,
		sourceTable: "alerts",
		sourceKind: "timeline_alert_review_snapshot",
		kind: /עדכון|update/iu.test(r) ? "update" : "alert",
		alertType: r,
		title: Bt(t.title) || "התראה שנשמרה לבדיקת צוות",
		date: Bt(t.date) || null,
		severity: t.severity == null ? null : Number(t.severity),
		status: Bt(t.status) || null,
		href: null,
		activityKey: null,
		reviewSnapshot: !0
	};
}
function Ht(e = [], t = []) {
	let n = Array.isArray(e) ? e : [], r = new Map(n.map((e) => [Bt(e?.id), e])), i = /* @__PURE__ */ new Map(), a = [];
	for (let e of Array.isArray(t) ? t : []) {
		let t = Bt(e?.sourceId);
		if (!t || i.has(t)) continue;
		let n = r.get(t);
		if (n?.activityKey) continue;
		let o = !n;
		i.set(t, o ? {
			...e,
			detachedFromCurrentFeed: !0
		} : e), o && a.push(Vt(e));
	}
	let o = new Set(i.keys()), s = n.filter((e) => o.has(Bt(e?.id))), c = n.filter((e) => !o.has(Bt(e?.id)));
	return {
		items: [
			...a,
			...s,
			...c
		],
		agentResults: Object.fromEntries(i),
		detachedCount: a.length
	};
}
//#endregion
//#region src/react/scheduleActivityAssignmentPresentation.js
var Ut = Object.freeze({
	noHardConflict: "לא זוהתה סתירה מהותית",
	canonicalDate: "יש להתראה תאריך מקור תקין",
	activeScheduleActivity: "המועמד שייך לגרסת לוח הזמנים הפעילה",
	unassigned: "ההתראה עדיין אינה משויכת",
	freshRun: "הריצה עדיין עדכנית",
	autoAssignmentEnabled: "מדיניות השיוך האוטומטי פעילה",
	requiredRolesCompleted: "כל בדיקות המודל הנדרשות הושלמו",
	matcherValidatorAgreement: "בודקי המודל הסכימו על אותה פעילות",
	decisionMatch: "התקבלה החלטת התאמה חד-משמעית",
	calibratedThreshold: "ההסתברות המכוילת עברה את הסף",
	margin: "הפער מהמועמד הבא עבר את הסף"
}), Wt = Object.freeze({
	calibrator_unavailable: "לא הוגדר מכייל תואם לריצה",
	artifact_version_mismatch: "גרסת המכייל אינה תואמת לגרסת המנוע",
	feature_version_mismatch: "גרסת נתוני הכיול אינה תואמת לריצה",
	engineVersion_mismatch: "גרסת המכייל אינה תואמת לגרסת המנוע",
	scheduleVersionId_mismatch: "המכייל אינו תואם לגרסת לוח הזמנים",
	settingsVersion_mismatch: "המכייל אינו תואם לגרסת ההגדרות",
	configurationSnapshotId_mismatch: "המכייל אינו תואם לתמונת ההגדרות",
	minimum_evidence_not_met: "עדיין אין מספיק ראיות להפעלת המכייל",
	selected_method_is_control: "ריצת הבקרה לא מפיקה הסתברות מכוילת",
	calibrator_prediction_failed: "המכייל לא הצליח להפיק הסתברות תקפה"
});
function Gt(e) {
	if (e == null || e === "") return null;
	let t = Number(e);
	return Number.isFinite(t) ? t : null;
}
function Kt(e) {
	let t = Gt(e);
	return t == null ? "לא זמין" : Number(t.toFixed(2)).toLocaleString("he-IL", { maximumFractionDigits: 2 });
}
function qt(e, t, n) {
	!n || e.some((e) => e.key === t || e.label === n) || e.push({
		key: t,
		label: n
	});
}
function Jt({ decision: e, gates: t, policy: n, calibratedProbability: r, calibrationStatus: i }) {
	let a = [], o = String(e?.type || e?.decision || "");
	if (o === "no_match" && qt(a, "decision_no_match", "אף מועמד לא עבר את סף ההצעה"), o === "ambiguous" && qt(a, "decision_ambiguous", "המודל לא קיבל החלטת התאמה חד-משמעית"), o === "conflict" && qt(a, "decision_conflict", "זוהתה סתירה מהותית בין הנתונים"), t.calibratedThreshold === !1) if (i === "calibrated" && r != null) {
		let e = Gt(n.calibratedProbabilityThreshold);
		qt(a, "calibratedThreshold", e == null ? "ההסתברות המכוילת לא עברה את סף המדיניות" : `ההסתברות המכוילת ${Math.round(r * 100)}% נמוכה מהסף ${Kt(e)}%`);
	} else qt(a, "calibrationUnavailable", Wt[String(e?.calibration?.reason || "")] || "לא הייתה הסתברות מכוילת תקפה לריצה זו");
	if (t.margin === !1) {
		let t = Gt(e?.rankingGap ?? e?.margin), r = Gt(n.minimumRankingGap);
		qt(a, "margin", t == null || r == null ? "הפער מהמועמד הבא קטן מהפער הנדרש" : `פער הדירוג ${Kt(t)} קטן מהפער הנדרש ${Kt(r)} נקודות`);
	}
	return t.noHardConflict === !1 && qt(a, "noHardConflict", "זוהתה סתירה מהותית בנתונים"), t.matcherValidatorAgreement === !1 && qt(a, "matcherValidatorAgreement", "בודק ההתאמה ובודק לוח הזמנים לא הסכימו על אותה פעילות"), t.requiredRolesCompleted === !1 && qt(a, "requiredRolesCompleted", "לא כל בדיקות המודל הנדרשות הושלמו"), t.canonicalDate === !1 && qt(a, "canonicalDate", "להתראה אין תאריך מקור תקין"), t.activeScheduleActivity === !1 && qt(a, "activeScheduleActivity", "המועמד אינו שייך לגרסת לוח הזמנים הפעילה"), t.freshRun === !1 && qt(a, "freshRun", "הריצה אינה עדכנית עוד"), t.unassigned === !1 && qt(a, "unassigned", "ההתראה כבר משויכת לפעילות"), t.autoAssignmentEnabled === !1 && qt(a, "autoAssignmentEnabled", "מדיניות השיוך האוטומטי כבויה כרגע"), !a.length && e?.autoAssigned !== !0 && qt(a, "humanReview", "המדיניות דרשה בדיקה אנושית לפני שיוך"), a;
}
function Yt(e = {}) {
	let t = e && typeof e == "object" ? e : {}, n = t.decision && typeof t.decision == "object" ? t.decision : {}, r = n.gates && typeof n.gates == "object" ? n.gates : {}, i = n.policy && typeof n.policy == "object" ? n.policy : {}, a = Gt(n.rankingScore ?? n.confidence) ?? 0, o = Gt(n.runnerUpRankingScore ?? n.runnerUpConfidence), s = Gt(n.rankingGap ?? n.margin) ?? 0, c = Gt(n.calibratedProbability), l = String(n.calibration?.status || "unavailable"), u = l === "calibrated" && c != null ? Math.max(0, Math.min(1, c)) : null, d = Array.isArray(t.candidates) && t.candidates.length > 1 || o != null && o > 0, f = Object.entries(Ut).filter(([e]) => typeof r[e] == "boolean").map(([e, t]) => ({
		key: e,
		label: t,
		passed: r[e] === !0
	})), p = [
		{
			key: "engineVersion",
			label: "גרסת מנוע",
			value: t.engineVersion || n.engineVersion || null
		},
		{
			key: "settingsVersion",
			label: "גרסת הגדרות",
			value: t.settingsVersion || n.settingsVersion || null
		},
		{
			key: "scheduleVersionId",
			label: "גרסת לוח זמנים",
			value: t.scheduleVersionId || n.scheduleVersionId || null
		},
		{
			key: "calibrator",
			label: "מכייל",
			value: n.calibration?.artifactId || null
		},
		{
			key: "calibrationStatus",
			label: "מצב כיול",
			value: l || null
		}
	].filter((e) => e.value);
	return {
		rankingScore: a,
		runnerUpRankingScore: o,
		rankingGap: s,
		hasRunnerUp: d,
		calibratedProbability: u,
		calibrationStatus: l,
		policy: i,
		reviewReasons: Jt({
			decision: n,
			gates: r,
			policy: i,
			calibratedProbability: u,
			calibrationStatus: l
		}),
		gateRows: f,
		auditItems: p
	};
}
//#endregion
//#region src/react/SchedulePage.jsx
var Xt = {
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
}, Zt = {
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
}, Qt = {
	contract_finish: "החוזה",
	contractor_planned_finish: "לוח הקבלן",
	forecast_finish: "תחזית"
}, $t = {
	contractAxis: "ציר חוזי",
	scheduleVersions: "גרסאות לוח",
	dependencies: "תלויות",
	observedEvents: "אירועי שטח",
	calendar: "לוח שנה"
}, en = [
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
], tn = 120;
async function nn(e, { method: t = "GET", body: n = null, timeoutMs: r = 12e4, cache: i = "default" } = {}) {
	let a = new AbortController(), o = setTimeout(() => a.abort(), r);
	try {
		let r = await fetch(e, {
			method: t,
			headers: n ? { "Content-Type": "application/json" } : void 0,
			body: n ? JSON.stringify(n) : void 0,
			cache: i,
			signal: a.signal
		}), o = await r.json().catch(() => ({}));
		if (!r.ok) throw Error(o.error || `HTTP ${r.status}`);
		return o;
	} finally {
		clearTimeout(o);
	}
}
function rn(e = []) {
	let t = e.map(({ label: e, error: t }) => `${e}: ${t?.message || "שגיאה לא ידועה"}`), n = /(?:522|connection terminated|connection timeout|failed to fetch|abort|timeout)/iu;
	return `${t.some((e) => n.test(e)) ? "APP DATA אינו זמין כרגע (522/timeout). נתוני לוח הזמנים המוצגים חלקיים או אינם זמינים." : "לא ניתן היה להשלים את טעינת נתוני לוח הזמנים. הנתונים המוצגים עשויים להיות חלקיים."} לא בוצע שינוי בנתונים. אפשר לנסות שוב לאחר שחיבור Supabase יתאושש.`;
}
function an(e) {
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
function on(e) {
	return !e?.basis || !e?.basisDate ? "ללא בסיס" : `מול ${Qt[e.basis] ?? e.basis}: ${e.basisDate}`;
}
var sn = ({ status: e }) => /* @__PURE__ */ (0, x.jsx)("span", {
	className: `schedBadge schedTone-${Zt[e] ?? "unknown"}`,
	children: Xt[e] ?? e
}), cn = ({ confidence: e }) => {
	if (!e) return null;
	let t = e.level ?? "low", n = t === "high" ? "ביטחון גבוה" : t === "medium" ? "ביטחון בינוני" : "ביטחון נמוך";
	return /* @__PURE__ */ (0, x.jsxs)("span", {
		className: `schedBadge schedConf-${t}`,
		title: `ציון: ${e.score}`,
		children: [t === "low" ? "⚠ " : "", n]
	});
}, ln = ({ gates: e, compact: t = !1 }) => e ? /* @__PURE__ */ (0, x.jsxs)("div", {
	className: `schedGates ${t ? "is-compact" : ""}`,
	children: [!t && /* @__PURE__ */ (0, x.jsx)("span", {
		className: "schedGatesTitle",
		children: "מה נבדק:"
	}), Object.entries($t).map(([t, n]) => {
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
}) : null, un = ({ showLateLines: e = !0 }) => /* @__PURE__ */ (0, x.jsxs)("div", {
	className: "axisLegend",
	children: [
		/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("i", { className: "axisSwatch swPlan" }), " תכנון הקבלן"] }),
		/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("i", { className: "axisSwatch swFill" }), " % ביצוע מדווח"] }),
		e ? /* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("i", { className: "axisSwatch swLate" }), " חריגה עד \"נכון ל-\""] }) : null,
		/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("i", {
			className: "axisSwatch swForecast",
			children: "◆"
		}), " תחזית סיום"] }),
		/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("i", {
			className: "axisSwatch swContract",
			children: "⚑"
		}), " אבן דרך חוזית"] }),
		/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("i", {
			className: "axisSwatch swTrigger",
			children: "▶"
		}), " תחילת ספירה חוזית"] }),
		/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("i", { className: "axisSwatch swObserved" }), " ביצוע נצפה (BIDoc)"] }),
		/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("i", {
			className: "axisSwatch swActivityEvent",
			children: "●"
		}), " עדכון / התראה משויכים"] }),
		/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("i", { className: "axisSwatch swToday" }), " קו \"נכון ל-\""] })
	]
});
function dn({ indicator: e, scale: t, asOf: n, showLateLines: r = !0, selected: i, onSelect: a, eventCount: o = 0, expanded: s = !1, onToggleEvents: c }) {
	let l = e.timing ?? {}, u = e.lateness ?? {}, d = t.pos(l.plannedStart), f = t.pos(l.plannedFinish), p = t.pos(l.contractFinish), m = t.pos(l.forecastFinish), h = t.pos(l.observedStart), g = t.pos(l.observedFinish), _ = t.pos(u.basisDate), v = t.pos(n), y = l.percentComplete, b = u.isLate === !0;
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		className: `axisRow ${i ? "is-selected" : ""}`,
		onClick: () => a(e),
		children: [/* @__PURE__ */ (0, x.jsxs)("div", {
			className: "axisTrack",
			dir: "ltr",
			children: [
				/* @__PURE__ */ (0, x.jsx)("div", {
					className: "axisLane",
					children: p == null ? null : /* @__PURE__ */ (0, x.jsx)("span", {
						className: "axisContractFlag",
						style: { left: `${p}%` },
						title: `מועד חוזי: ${l.contractFinish}`,
						children: "⚑"
					})
				}),
				/* @__PURE__ */ (0, x.jsxs)("div", {
					className: "axisLane",
					children: [d != null && f != null && /* @__PURE__ */ (0, x.jsx)("div", {
						className: `axisBarPlan ${e.subject.isMilestone ? "is-milestone" : ""}`,
						style: {
							left: `${d}%`,
							width: `${Math.max(f - d, .6)}%`
						},
						title: `תכנון: ${l.plannedStart} → ${l.plannedFinish}`,
						children: y != null && y > 0 ? /* @__PURE__ */ (0, x.jsx)("div", {
							className: "axisBarFill",
							style: { width: `${y}%` },
							title: `${y}% ביצוע מדווח`
						}) : null
					}), r && b && _ != null && v != null && v > _ && /* @__PURE__ */ (0, x.jsx)("div", {
						className: "axisBarLate",
						style: {
							left: `${_}%`,
							width: `${v - _}%`
						},
						title: `${an(u)} — ${on(u)}`
					})]
				}),
				/* @__PURE__ */ (0, x.jsx)("div", {
					className: "axisLane",
					children: h != null || g != null ? /* @__PURE__ */ (0, x.jsx)("div", {
						className: "axisBarObserved",
						style: {
							left: `${h ?? g}%`,
							width: `${Math.max((g ?? h) - (h ?? g), .6)}%`
						},
						title: `ביצוע נצפה: ${l.observedStart ?? "?"} → ${l.observedFinish ?? "?"}`
					}) : m == null ? null : /* @__PURE__ */ (0, x.jsx)("span", {
						className: "axisForecast",
						style: { left: `${m}%` },
						title: `תחזית סיום: ${l.forecastFinish}`,
						children: "◆"
					})
				})
			]
		}), /* @__PURE__ */ (0, x.jsxs)("div", {
			className: "axisName",
			children: [/* @__PURE__ */ (0, x.jsxs)("span", {
				className: "axisNameTitleLine",
				children: [o ? /* @__PURE__ */ (0, x.jsxs)("button", {
					type: "button",
					className: "axisExpandBtn",
					"aria-expanded": s,
					"aria-label": `${s ? "סגור" : "פתח"} ${o} עדכונים והתראות`,
					onClick: (e) => {
						e.stopPropagation(), c();
					},
					children: [s ? "▾" : "◂", /* @__PURE__ */ (0, x.jsx)("b", { children: o })]
				}) : null, /* @__PURE__ */ (0, x.jsxs)("span", {
					className: "axisNameText",
					title: e.subject.name,
					children: [e.subject.isMilestone ? "◆ " : "", e.subject.name]
				})]
			}), /* @__PURE__ */ (0, x.jsxs)("span", {
				className: "axisNameMeta",
				children: [/* @__PURE__ */ (0, x.jsx)(sn, { status: e.status }), /* @__PURE__ */ (0, x.jsx)("span", {
					className: "axisLateText",
					children: an(u)
				})]
			})]
		})]
	});
}
function fn({ item: e, scale: t }) {
	let n = t.pos(e.date);
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		className: "axisEventRow",
		children: [/* @__PURE__ */ (0, x.jsx)("div", {
			className: "axisTrack",
			dir: "ltr",
			children: n == null ? null : /* @__PURE__ */ (0, x.jsx)("span", {
				className: `axisEventPoint is-${e.kind}`,
				style: { left: `${n}%` },
				title: `${e.alertType} · ${e.date} · ${e.title}`,
				children: "●"
			})
		}), /* @__PURE__ */ (0, x.jsxs)("div", {
			className: "axisName axisEventName",
			children: [
				/* @__PURE__ */ (0, x.jsx)("span", {
					className: `activityUpdateKind is-${e.kind}`,
					children: e.kind === "update" ? "עדכון" : "התראה"
				}),
				/* @__PURE__ */ (0, x.jsx)("span", {
					className: "axisNameText",
					title: e.title,
					children: e.title
				}),
				/* @__PURE__ */ (0, x.jsx)("time", { children: e.date || "ללא תאריך" })
			]
		})]
	});
}
function pn({ indicators: e, allIndicators: t, pendingConditions: n, timelineItems: r, asOf: i, showLateLines: a, showAsOfMarker: o, selected: s, onSelect: c }) {
	let [l, u] = (0, b.useState)(() => /* @__PURE__ */ new Set()), d = (0, b.useMemo)(() => (n ?? []).flatMap((e) => {
		let t = e?.metadata?.trigger_evidence?.provisionalDueDate;
		return t ? [{
			date: t,
			name: e.name || "אבן דרך חוזית",
			provisional: !0
		}] : [];
	}), [n]), f = (0, b.useMemo)(() => {
		let e = /* @__PURE__ */ new Map();
		for (let t of n ?? []) {
			let n = t?.trigger_event_date;
			if (!n) continue;
			let r = e.get(n) || {
				date: n,
				names: []
			}, i = t.name || "נקודת זמן חוזית";
			r.names.includes(i) || r.names.push(i), e.set(n, r);
		}
		return [...e.values()].map((e) => ({
			date: e.date,
			name: e.names.join(" · "),
			count: e.names.length
		}));
	}, [n]), p = (0, b.useMemo)(() => [
		...t ?? e,
		...d.map((e) => ({ timing: { contractFinish: e.date } })),
		...f.map((e) => ({ timing: { contractFinish: e.date } })),
		...(r ?? []).filter((e) => e.activityKey && e.date).map((e) => ({ timing: { contractFinish: e.date } }))
	], [
		t,
		e,
		d,
		f,
		r
	]), m = o ? e : t ?? e, h = (0, b.useMemo)(() => vt(m, o ? i : null, p), [
		m,
		p,
		i,
		o
	]), g = (0, b.useMemo)(() => {
		let n = /* @__PURE__ */ new Map();
		for (let r of t ?? e) {
			let e = r.timing?.contractFinish;
			!e || n.has(e) || n.set(e, {
				date: e,
				name: r.subject?.milestoneKey ? r.subject.name : "אבן דרך חוזית"
			});
		}
		for (let e of d) n.has(e.date) || n.set(e.date, e);
		return [...n.values()];
	}, [
		e,
		t,
		d
	]), _ = (0, b.useMemo)(() => {
		let e = /* @__PURE__ */ new Map();
		for (let t of r ?? []) {
			if (!t.activityKey || !t.date) continue;
			let n = e.get(t.activityKey) || [];
			n.push(t), e.set(t.activityKey, n);
		}
		for (let t of e.values()) t.sort((e, t) => String(e.date).localeCompare(String(t.date)));
		return e;
	}, [r]), v = (e) => u((t) => {
		let n = new Set(t);
		return n.has(e) ? n.delete(e) : n.add(e), n;
	});
	if (!h) return /* @__PURE__ */ (0, x.jsx)("div", {
		className: "schedEmpty",
		children: "אין תאריכים להצגה"
	});
	let y = e.slice(0, tn), S = o ? h.pos(i) : null, C = a && o;
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		className: "axesView",
		children: [
			/* @__PURE__ */ (0, x.jsx)(un, { showLateLines: C }),
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "axesBody",
				children: [/* @__PURE__ */ (0, x.jsxs)("div", {
					className: "axesTimeArea",
					dir: "ltr",
					children: [/* @__PURE__ */ (0, x.jsx)("div", {
						className: "axesMonths",
						children: h.months.map((e) => /* @__PURE__ */ (0, x.jsxs)("span", {
							className: "axesMonthTick",
							style: { left: `${e.left}%` },
							children: [
								en[e.month],
								" ",
								String(e.year).slice(2)
							]
						}, e.iso))
					}), /* @__PURE__ */ (0, x.jsxs)("div", {
						className: "axesRowsOverlay",
						children: [
							h.months.map((e) => /* @__PURE__ */ (0, x.jsx)("span", {
								className: "axesGridLine",
								style: { left: `${e.left}%` }
							}, e.iso)),
							f.map((e) => {
								let t = h.pos(e.date);
								if (t == null) return null;
								let n = `תחילת ספירה: ${e.name} · ${_t(e.date)}`;
								return /* @__PURE__ */ (0, x.jsx)("span", {
									className: "axesTriggerLine",
									style: { left: `${t}%` },
									title: n,
									children: /* @__PURE__ */ (0, x.jsxs)("label", { children: [
										"▶ ",
										n,
										e.count > 1 ? ` (${e.count})` : ""
									] })
								}, `trigger:${e.date}`);
							}),
							g.map((e) => {
								let t = h.pos(e.date);
								return t == null ? null : /* @__PURE__ */ (0, x.jsx)("span", {
									className: `axesContractLine ${e.provisional ? "is-provisional" : ""}`,
									style: { left: `${t}%` },
									title: e.provisional ? "מועד משוער בלבד — ממתין להשלמת לוח ימי העבודה והחגים" : void 0,
									children: /* @__PURE__ */ (0, x.jsxs)("label", { children: [
										"⚑ ",
										e.provisional ? "משוער: " : "",
										e.name,
										" · ",
										e.date
									] })
								}, `${e.date}:${e.name}`);
							}),
							S != null && /* @__PURE__ */ (0, x.jsx)("span", {
								className: "axesTodayLine",
								style: { left: `${S}%` },
								children: /* @__PURE__ */ (0, x.jsxs)("label", { children: ["נכון ל-", i] })
							})
						]
					})]
				}), /* @__PURE__ */ (0, x.jsx)("div", {
					className: "axesRows",
					children: y.map((e) => {
						let t = yt(e), n = _.get(t) || [], r = l.has(t);
						return /* @__PURE__ */ (0, x.jsxs)(b.Fragment, { children: [/* @__PURE__ */ (0, x.jsx)(dn, {
							indicator: e,
							scale: h,
							asOf: i,
							showLateLines: C,
							selected: yt(s) === t,
							onSelect: c,
							eventCount: n.length,
							expanded: r,
							onToggleEvents: () => v(t)
						}), r ? n.map((e) => /* @__PURE__ */ (0, x.jsx)(fn, {
							item: e,
							scale: h
						}, `${e.sourceTable}:${e.id}`)) : null] }, t);
					})
				})]
			}),
			e.length > tn ? /* @__PURE__ */ (0, x.jsxs)("div", {
				className: "axesCapNote",
				children: [
					"מוצגות ",
					tn,
					" הפעילויות החמורות מתוך ",
					e.length,
					" — צמצם עם הפילטרים למעלה"
				]
			}) : null
		]
	});
}
function mn({ activities: e, value: t, disabled: n, busy: r, onChange: i }) {
	let a = (0, b.useRef)(null), [o, s] = (0, b.useState)(""), c = e.find((e) => e.key === t), l = e.filter((e) => `${e.name} ${e.dateLabel}`.toLocaleLowerCase("he").includes(o.trim().toLocaleLowerCase("he"))).slice(0, 80), u = (e) => {
		i(e), s(""), a.current && (a.current.open = !1);
	};
	return /* @__PURE__ */ (0, x.jsxs)("details", {
		ref: a,
		className: "activityPicker",
		children: [/* @__PURE__ */ (0, x.jsx)("summary", {
			className: t ? "" : "is-empty",
			"aria-disabled": n || r,
			onClick: (e) => {
				(n || r) && e.preventDefault();
			},
			children: r ? "שומר…" : c ? `${c.name} · ${c.dateLabel}` : "בחר פעילות"
		}), /* @__PURE__ */ (0, x.jsxs)("div", {
			className: "activityPickerMenu",
			children: [
				/* @__PURE__ */ (0, x.jsx)("input", {
					type: "search",
					value: o,
					onChange: (e) => s(e.target.value),
					placeholder: "חיפוש פעילות…",
					autoFocus: !0
				}),
				t ? /* @__PURE__ */ (0, x.jsx)("button", {
					type: "button",
					className: "activityPickerClear",
					onClick: () => u(null),
					children: "נקה שיוך"
				}) : null,
				/* @__PURE__ */ (0, x.jsxs)("div", {
					className: "activityPickerOptions",
					children: [l.map((e) => /* @__PURE__ */ (0, x.jsxs)("button", {
						type: "button",
						className: e.key === t ? "is-selected" : "",
						onClick: () => u(e.key),
						title: e.name,
						children: [/* @__PURE__ */ (0, x.jsx)("span", { children: e.name }), /* @__PURE__ */ (0, x.jsx)("small", { children: e.dateLabel })]
					}, e.key)), l.length ? null : /* @__PURE__ */ (0, x.jsx)("span", {
						className: "activityPickerEmpty",
						children: "לא נמצאה פעילות"
					})]
				})
			]
		})]
	});
}
function hn({ items: e, activities: t, busyId: n, onAssign: r, agentBusyId: i, agentResults: a, onRunAgent: o, onConfirmAgent: s, onRejectAgent: c, agentBatch: l, onStartAgentBatch: u, onStopAgentBatch: d, onResumeAgentBatch: f, onRestartAgentBatch: p, timeFilterEnabled: m, onTimeFilterChange: h, batchLimit: g, onBatchLimitChange: _, labelCoverage: v, shadowObservedSourceIds: y }) {
	let [S, C] = (0, b.useState)(() => ({ ...wt })), [w, T] = (0, b.useState)(100), E = (0, b.useDeferredValue)(S.query), D = (0, b.useDeferredValue)(S.text), O = (0, b.useDeferredValue)(S.activity), k = (0, b.useMemo)(() => ({
		...S,
		query: E,
		text: D,
		activity: O
	}), [
		S,
		E,
		D,
		O
	]), A = (0, b.useMemo)(() => Dt(e, t, k), [
		e,
		t,
		k
	]), j = A.filter((e) => e.activityKey).length, M = Object.values(a || {}).filter((e) => e?.persistedReview && !e?.approved && !e?.rejected).length, N = Array.isArray(y), P = (0, b.useMemo)(() => N ? At(A, { excludedSourceIds: y }).length : 0, [
		A,
		N,
		y
	]), F = Math.min(P, kt(g)), I = (0, b.useMemo)(() => [...new Set(e.map((e) => e.severity).filter((e) => e != null))].sort((e, t) => Number(e) - Number(t)), [e]), L = (0, b.useMemo)(() => [...new Set(e.map((e) => String(e.status || "").trim()).filter(Boolean))].sort((e, t) => e.localeCompare(t, "he")), [e]), R = Et(S), z = (0, b.useCallback)((e, t) => {
		C((n) => ({
			...n,
			[e]: t
		})), T(100);
	}, []), ee = (0, b.useCallback)(() => {
		C({ ...wt }), T(100);
	}, []), te = l.status === bt.RUNNING || l.status === bt.STOPPING, B = !!(i || n), V = It(l);
	return /* @__PURE__ */ (0, x.jsxs)("section", {
		className: "activityUpdatesPanel",
		"aria-labelledby": "activity-updates-title",
		children: [
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "activityUpdatesHead",
				children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("h3", {
					id: "activity-updates-title",
					children: "עדכונים והתראות על ציר הזמן"
				}), /* @__PURE__ */ (0, x.jsxs)("p", {
					"aria-live": "polite",
					children: [
						R ? `${A.length} מתוך ${e.length}` : e.length,
						" פריטים · ",
						j,
						" משויכים לפעילות",
						M ? ` · ${M} ממתינים להחלטת צוות` : "",
						v ? ` · ${v.caseCount || 0} תוויות כיול מפורשות` : ""
					]
				})] }), /* @__PURE__ */ (0, x.jsxs)("div", {
					className: "activityUpdatesHeadTools",
					children: [
						/* @__PURE__ */ (0, x.jsxs)("div", {
							className: "activityAgentBatchControls",
							"aria-label": "בדיקה קבוצתית של התראות לא משויכות",
							children: [
								/* @__PURE__ */ (0, x.jsxs)("label", {
									className: "activityAgentBatchLimit",
									children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "כמות לבדיקה" }), /* @__PURE__ */ (0, x.jsx)("select", {
										value: g,
										disabled: te,
										onChange: (e) => _(kt(e.target.value)),
										children: xt.map((e) => /* @__PURE__ */ (0, x.jsx)("option", {
											value: e,
											children: e
										}, e))
									})]
								}),
								/* @__PURE__ */ (0, x.jsxs)("label", {
									className: "activityAgentTimeFilter",
									title: "בריצה קבוצתית בלבד: דלג על התראות שאינן קשורות לזמן, עיכוב, תאריך או לוח זמנים",
									children: [/* @__PURE__ */ (0, x.jsx)("input", {
										type: "checkbox",
										checked: m,
										disabled: te,
										onChange: (e) => h(e.target.checked)
									}), /* @__PURE__ */ (0, x.jsx)("span", { children: "סינון זמן" })]
								}),
								l.status === bt.PAUSED ? /* @__PURE__ */ (0, x.jsxs)(x.Fragment, { children: [/* @__PURE__ */ (0, x.jsx)("button", {
									type: "button",
									className: "activityAgentBatchButton is-primary",
									disabled: B,
									onClick: f,
									children: "המשך מאותה נקודה"
								}), /* @__PURE__ */ (0, x.jsx)("button", {
									type: "button",
									className: "activityAgentBatchButton",
									disabled: B || !P,
									onClick: () => p(A, g),
									children: "הרץ מחדש"
								})] }) : l.status === bt.COMPLETED ? /* @__PURE__ */ (0, x.jsx)("button", {
									type: "button",
									className: "activityAgentBatchButton",
									disabled: !P,
									onClick: () => p(A, g),
									children: "הרץ מחדש"
								}) : /* @__PURE__ */ (0, x.jsxs)(x.Fragment, { children: [/* @__PURE__ */ (0, x.jsx)("button", {
									type: "button",
									className: "activityAgentBatchButton is-primary",
									disabled: te || B || !P,
									onClick: () => u(A, g),
									children: N ? P ? `בדוק ${F} מתוך ${P} חדשות` : "אין התראות חדשות לבדיקה" : "היסטוריית הבדיקות אינה זמינה"
								}), te ? /* @__PURE__ */ (0, x.jsx)("button", {
									type: "button",
									className: "activityAgentBatchButton is-stop",
									disabled: l.status === bt.STOPPING,
									onClick: d,
									children: l.status === bt.STOPPING ? "עוצר…" : "עצור"
								}) : null] })
							]
						}),
						N ? P ? /* @__PURE__ */ (0, x.jsxs)("p", {
							className: "activityAgentBatchExplanation",
							children: [P, " התראות חדשות ממתינות לבדיקה. מקרים שכבר נשמרו במצב הצל אינם נספרים שוב."]
						}) : null : /* @__PURE__ */ (0, x.jsx)("p", {
							className: "activityAgentBatchExplanation",
							children: "לא ניתן להתחיל בדיקה קבוצתית בלי היסטוריית המקרים שכבר נבדקו."
						}),
						V ? /* @__PURE__ */ (0, x.jsxs)("div", {
							className: `activityAgentBatchStatus is-${l.status}`,
							role: "status",
							"aria-live": "polite",
							children: [/* @__PURE__ */ (0, x.jsx)("progress", {
								max: Math.max(l.total, 1),
								value: l.processed,
								"aria-label": V
							}), /* @__PURE__ */ (0, x.jsx)("span", { children: V })]
						}) : null,
						/* @__PURE__ */ (0, x.jsxs)("div", {
							className: "activityUpdatesGlobalFilter",
							children: [/* @__PURE__ */ (0, x.jsx)("input", {
								type: "search",
								value: S.query,
								onChange: (e) => z("query", e.target.value),
								placeholder: "חיפוש כללי בעדכונים והתראות…",
								"aria-label": "חיפוש כללי בעדכונים והתראות"
							}), /* @__PURE__ */ (0, x.jsx)("button", {
								type: "button",
								onClick: ee,
								disabled: !R,
								children: "נקה מסננים"
							})]
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, x.jsx)("div", {
				className: "activityUpdatesTableWrap",
				children: /* @__PURE__ */ (0, x.jsxs)("table", {
					className: "activityUpdatesTable",
					children: [/* @__PURE__ */ (0, x.jsxs)("thead", { children: [/* @__PURE__ */ (0, x.jsxs)("tr", {
						className: "activityUpdatesHeaderRow",
						children: [
							/* @__PURE__ */ (0, x.jsx)("th", { children: "סוג" }),
							/* @__PURE__ */ (0, x.jsx)("th", { children: "תאריך" }),
							/* @__PURE__ */ (0, x.jsx)("th", { children: "התראה / עדכון" }),
							/* @__PURE__ */ (0, x.jsx)("th", { children: "חומרה" }),
							/* @__PURE__ */ (0, x.jsx)("th", { children: "סטטוס" }),
							/* @__PURE__ */ (0, x.jsx)("th", { children: "שיוך לפעילות בלוח" })
						]
					}), /* @__PURE__ */ (0, x.jsxs)("tr", {
						className: "activityUpdatesFilterRow",
						children: [
							/* @__PURE__ */ (0, x.jsx)("th", { children: /* @__PURE__ */ (0, x.jsxs)("select", {
								value: S.kind,
								onChange: (e) => z("kind", e.target.value),
								"aria-label": "סינון לפי סוג",
								children: [
									/* @__PURE__ */ (0, x.jsx)("option", {
										value: "",
										children: "כל הסוגים"
									}),
									/* @__PURE__ */ (0, x.jsx)("option", {
										value: "alert",
										children: "התראות"
									}),
									/* @__PURE__ */ (0, x.jsx)("option", {
										value: "update",
										children: "עדכונים"
									})
								]
							}) }),
							/* @__PURE__ */ (0, x.jsx)("th", { children: /* @__PURE__ */ (0, x.jsxs)("div", {
								className: "activityUpdatesDateFilter",
								children: [/* @__PURE__ */ (0, x.jsxs)("label", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "מ־" }), /* @__PURE__ */ (0, x.jsx)("input", {
									type: "date",
									value: S.dateFrom,
									max: S.dateTo || void 0,
									onChange: (e) => z("dateFrom", e.target.value),
									"aria-label": "סינון מתאריך"
								})] }), /* @__PURE__ */ (0, x.jsxs)("label", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "עד" }), /* @__PURE__ */ (0, x.jsx)("input", {
									type: "date",
									value: S.dateTo,
									min: S.dateFrom || void 0,
									onChange: (e) => z("dateTo", e.target.value),
									"aria-label": "סינון עד תאריך"
								})] })]
							}) }),
							/* @__PURE__ */ (0, x.jsx)("th", { children: /* @__PURE__ */ (0, x.jsx)("input", {
								type: "search",
								value: S.text,
								onChange: (e) => z("text", e.target.value),
								placeholder: "חיפוש בתוכן…",
								"aria-label": "סינון לפי תוכן ההתראה או העדכון"
							}) }),
							/* @__PURE__ */ (0, x.jsx)("th", { children: /* @__PURE__ */ (0, x.jsxs)("select", {
								value: S.severity,
								onChange: (e) => z("severity", e.target.value),
								"aria-label": "סינון לפי חומרה",
								children: [/* @__PURE__ */ (0, x.jsx)("option", {
									value: "",
									children: "הכול"
								}), I.map((e) => /* @__PURE__ */ (0, x.jsx)("option", {
									value: e,
									children: e
								}, e))]
							}) }),
							/* @__PURE__ */ (0, x.jsx)("th", { children: /* @__PURE__ */ (0, x.jsxs)("select", {
								value: S.status,
								onChange: (e) => z("status", e.target.value),
								"aria-label": "סינון לפי סטטוס",
								children: [/* @__PURE__ */ (0, x.jsx)("option", {
									value: "",
									children: "כל הסטטוסים"
								}), L.map((e) => /* @__PURE__ */ (0, x.jsx)("option", {
									value: e,
									children: e
								}, e))]
							}) }),
							/* @__PURE__ */ (0, x.jsx)("th", { children: /* @__PURE__ */ (0, x.jsxs)("div", {
								className: "activityUpdatesAssignmentFilter",
								children: [/* @__PURE__ */ (0, x.jsxs)("select", {
									value: S.assignmentState,
									onChange: (e) => z("assignmentState", e.target.value),
									"aria-label": "סינון לפי מצב שיוך",
									children: [
										/* @__PURE__ */ (0, x.jsx)("option", {
											value: "",
											children: "כל השיוכים"
										}),
										/* @__PURE__ */ (0, x.jsx)("option", {
											value: "assigned",
											children: "משויכים בלבד"
										}),
										/* @__PURE__ */ (0, x.jsx)("option", {
											value: "unassigned",
											children: "לא משויכים"
										})
									]
								}), /* @__PURE__ */ (0, x.jsx)("input", {
									type: "search",
									value: S.activity,
									onChange: (e) => z("activity", e.target.value),
									placeholder: "שם פעילות…",
									"aria-label": "סינון לפי שם הפעילות המשויכת"
								})]
							}) })
						]
					})] }), /* @__PURE__ */ (0, x.jsxs)("tbody", { children: [A.slice(0, w).map((e) => {
						let l = a?.[e.id], u = i === e.id, d = Nt(l), f = Pt(e, l), p = u || n === e.id || te, m = !!(l?.runId && l?.auditPersisted), h = !!(l?.persistedReview && l?.reviewId), g = Mt(e), _ = Yt(l);
						return /* @__PURE__ */ (0, x.jsxs)(b.Fragment, { children: [/* @__PURE__ */ (0, x.jsxs)("tr", {
							className: e.activityKey ? "is-assigned" : "",
							children: [
								/* @__PURE__ */ (0, x.jsx)("td", { children: /* @__PURE__ */ (0, x.jsx)("span", {
									className: `activityUpdateKind is-${e.kind}`,
									children: e.kind === "update" ? "עדכון" : "התראה"
								}) }),
								/* @__PURE__ */ (0, x.jsx)("td", {
									className: "activityUpdateDate",
									children: e.date || /* @__PURE__ */ (0, x.jsx)("span", {
										title: "נדרש data_date אמיתי",
										children: "ללא תאריך"
									})
								}),
								/* @__PURE__ */ (0, x.jsxs)("td", { children: [/* @__PURE__ */ (0, x.jsx)("div", {
									className: "activityUpdateTitle",
									title: e.title,
									children: e.href ? /* @__PURE__ */ (0, x.jsx)("a", {
										href: e.href,
										target: "_blank",
										rel: "noreferrer",
										children: e.title
									}) : e.title
								}), /* @__PURE__ */ (0, x.jsx)("small", { children: e.alertType })] }),
								/* @__PURE__ */ (0, x.jsx)("td", { children: e.severity ?? "—" }),
								/* @__PURE__ */ (0, x.jsx)("td", { children: e.status || "—" }),
								/* @__PURE__ */ (0, x.jsx)("td", { children: /* @__PURE__ */ (0, x.jsxs)("div", {
									className: "activityAssignmentActions",
									children: [/* @__PURE__ */ (0, x.jsx)(mn, {
										activities: t,
										value: e.activityKey,
										disabled: !e.date || te || l?.detachedFromCurrentFeed,
										busy: n === e.id,
										onChange: (t) => r(e, t)
									}), g ? /* @__PURE__ */ (0, x.jsx)("span", {
										className: `activityAssignmentMethod is-${g.key}`,
										children: g.label
									}) : /* @__PURE__ */ (0, x.jsx)("button", {
										type: "button",
										className: "activityAgentButton",
										disabled: !e.date || u || n === e.id || te || l?.detachedFromCurrentFeed,
										onClick: () => o(e),
										title: "בדוק התאמה והצג הצעות לפעילות עבור שורה זו",
										children: u ? "בודק התאמה…" : "בדיקת התאמה"
									})]
								}) })
							]
						}), l ? /* @__PURE__ */ (0, x.jsx)("tr", {
							className: "activityAgentResultRow",
							children: /* @__PURE__ */ (0, x.jsx)("td", {
								colSpan: 6,
								children: l.error ? /* @__PURE__ */ (0, x.jsx)("div", {
									className: "activityAgentResult is-error",
									children: l.error
								}) : l.status === "filtered_out" ? /* @__PURE__ */ (0, x.jsxs)("div", {
									className: "activityAgentResult is-filtered",
									children: [/* @__PURE__ */ (0, x.jsxs)("div", {
										className: "activityAgentResultHead",
										children: [/* @__PURE__ */ (0, x.jsx)("strong", { children: "דולג על ידי סינון זמן" }), /* @__PURE__ */ (0, x.jsxs)("span", { children: [
											"ביטחון ",
											l.timeFilter?.confidence ?? 0,
											"%"
										] })]
									}), /* @__PURE__ */ (0, x.jsx)("p", { children: l.timeFilter?.reason || "ההתראה אינה קשורה לזמן, עיכוב, תאריך או לוח זמנים." })]
								}) : /* @__PURE__ */ (0, x.jsxs)("div", {
									className: `activityAgentResult ${l.decision?.autoAssigned ? "is-auto" : ""}`,
									children: [
										/* @__PURE__ */ (0, x.jsxs)("div", {
											className: "activityAgentResultHead",
											children: [/* @__PURE__ */ (0, x.jsxs)("div", {
												className: "activityAgentResultIdentity",
												children: [
													/* @__PURE__ */ (0, x.jsx)("small", { children: "ההתראה שנבדקת" }),
													/* @__PURE__ */ (0, x.jsx)("strong", {
														title: f.alertTitle,
														children: f.alertTitle
													}),
													/* @__PURE__ */ (0, x.jsxs)("span", { children: [
														/* @__PURE__ */ (0, x.jsx)("b", { children: "הצעת הסוכן המובילה:" }),
														" ",
														f.recommendation
													] })
												]
											}), /* @__PURE__ */ (0, x.jsxs)("div", {
												className: "activityAgentResultScores",
												"aria-label": "נתוני דירוג וכיול",
												children: [
													/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("b", { children: "ציון התאמה מוביל" }), Kt(_.rankingScore)] }),
													_.hasRunnerUp ? /* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("b", { children: "ציון האפשרות השנייה" }), Kt(_.runnerUpRankingScore)] }) : null,
													/* @__PURE__ */ (0, x.jsxs)("span", { children: [
														/* @__PURE__ */ (0, x.jsx)("b", { children: "פער בדירוג" }),
														Kt(_.rankingGap),
														" נקודות"
													] }),
													/* @__PURE__ */ (0, x.jsxs)("span", {
														className: _.calibratedProbability == null ? "is-unavailable" : "is-calibrated",
														children: [/* @__PURE__ */ (0, x.jsx)("b", { children: "הסתברות מכוילת" }), _.calibratedProbability == null ? "לא זמינה בריצה זו" : `${Math.round(_.calibratedProbability * 100)}%`]
													})
												]
											})]
										}),
										l.persistedReview ? /* @__PURE__ */ (0, x.jsx)("span", {
											className: `activityAgentSharedReviewBadge ${l.approved || l.rejected ? "is-resolved" : ""}`,
											children: l.approved ? "נבחרה פעילות · הרשומה סומנה כטופלה" : l.rejected ? "ההצעות נדחו · הרשומה סומנה כטופלה" : "כרטיס הבדיקה נשמר · ממתין להחלטת צוות"
										}) : null,
										l.detachedFromCurrentFeed ? /* @__PURE__ */ (0, x.jsx)("small", {
											className: "activityAgentWarning",
											children: "ההתראה המקורית אינה נמצאת עוד בפיד הפעיל. ההחלטה תישמר כתווית כיול בלבד ולא תשנה שיוך בלוח."
										}) : null,
										l.decision?.autoAssigned !== !0 && _.reviewReasons.length ? /* @__PURE__ */ (0, x.jsxs)("div", {
											className: "activityAgentReviewReasons",
											children: [/* @__PURE__ */ (0, x.jsx)("strong", { children: "למה נדרשת בדיקה אנושית?" }), /* @__PURE__ */ (0, x.jsx)("ul", { children: _.reviewReasons.map((e) => /* @__PURE__ */ (0, x.jsx)("li", { children: e.label }, e.key)) })]
										}) : null,
										l.decision?.reason ? /* @__PURE__ */ (0, x.jsxs)("p", { children: [
											/* @__PURE__ */ (0, x.jsx)("b", { children: "סיכום הסוכן:" }),
											" ",
											l.decision.reason
										] }) : null,
										_.gateRows.length || _.auditItems.length ? /* @__PURE__ */ (0, x.jsxs)("details", {
											className: "activityAgentAuditDetails",
											children: [
												/* @__PURE__ */ (0, x.jsx)("summary", { children: "פרטי החלטה לביקורת" }),
												_.auditItems.length ? /* @__PURE__ */ (0, x.jsx)("dl", { children: _.auditItems.map((e) => /* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("dt", { children: e.label }), /* @__PURE__ */ (0, x.jsx)("dd", { children: e.value })] }, e.key)) }) : null,
												_.gateRows.length ? /* @__PURE__ */ (0, x.jsx)("div", {
													className: "activityAgentGateList",
													"aria-label": "בדיקות מדיניות",
													children: _.gateRows.map((e) => /* @__PURE__ */ (0, x.jsxs)("span", {
														className: e.passed ? "is-passed" : "is-failed",
														children: [
															e.passed ? "עבר" : "נכשל",
															" · ",
															e.label
														]
													}, e.key))
												}) : null
											]
										}) : null,
										d.length ? /* @__PURE__ */ (0, x.jsxs)("div", {
											className: "activityAgentReview",
											"aria-label": "בחירת פעילות מתוך הצעות הסוכן",
											children: [/* @__PURE__ */ (0, x.jsx)("strong", {
												className: "activityAgentReviewPrompt",
												children: "נדרשת החלטה שלך - בחר את הפעילות המתאימה:"
											}), /* @__PURE__ */ (0, x.jsxs)("div", {
												className: "activityAgentCandidates",
												role: "group",
												"aria-label": "פעילויות מוצעות",
												children: [d.map((t, n) => /* @__PURE__ */ (0, x.jsxs)("button", {
													type: "button",
													disabled: p,
													onClick: () => h || m ? s(e, l, t) : r(e, t.activityKey),
													children: [
														/* @__PURE__ */ (0, x.jsxs)("em", { children: [
															"אפשרות ",
															n + 1,
															n === 0 ? " · הצעת הסוכן המובילה" : ""
														] }),
														/* @__PURE__ */ (0, x.jsx)("span", { children: t.name }),
														/* @__PURE__ */ (0, x.jsxs)("small", { children: [
															"ציון התאמה ",
															t.finalScore,
															" · ",
															t.plannedStart || "?",
															"–",
															t.plannedFinish || "?"
														] })
													]
												}, t.activityKey)), h ? zt.map((t) => /* @__PURE__ */ (0, x.jsx)("button", {
													type: "button",
													className: "is-reject",
													disabled: p,
													onClick: () => c(e, l, t),
													children: t.labelHe
												}, t.type)) : m ? /* @__PURE__ */ (0, x.jsx)("button", {
													type: "button",
													className: "is-reject",
													disabled: p,
													onClick: () => c(e, l, zt[0]),
													children: "אף אפשרות אינה מתאימה"
												}) : null]
											})]
										}) : null,
										(l.warnings || []).map((e) => /* @__PURE__ */ (0, x.jsxs)("small", {
											className: "activityAgentWarning",
											children: ["⚠ ", e]
										}, e))
									]
								})
							})
						}) : null] }, `${e.sourceTable}:${e.id}`);
					}), A.length ? null : /* @__PURE__ */ (0, x.jsx)("tr", { children: /* @__PURE__ */ (0, x.jsx)("td", {
						colSpan: 6,
						className: "schedEmpty",
						children: "אין פריטים התואמים למסננים שנבחרו"
					}) })] })]
				})
			}),
			w < A.length ? /* @__PURE__ */ (0, x.jsx)("button", {
				type: "button",
				className: "activityUpdatesMore",
				onClick: () => T((e) => e + 100),
				children: "טען עוד 100"
			}) : null
		]
	});
}
var gn = ({ indicator: e, onClose: t }) => {
	if (!e) return null;
	let n = e.timing ?? {}, r = e.variances ?? {};
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		className: "schedDetail",
		children: [
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "schedDetailHead",
				children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [
					/* @__PURE__ */ (0, x.jsx)(sn, { status: e.status }),
					/* @__PURE__ */ (0, x.jsx)(cn, { confidence: e.confidence }),
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
					an(e.lateness),
					" · ",
					on(e.lateness)
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
			/* @__PURE__ */ (0, x.jsx)(ln, { gates: e.gates }),
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
}, _n = {
	execution: "ביצוע",
	payment: "תשלומים",
	notice: "הודעות",
	guarantee: "ערבויות",
	insurance: "ביטוחים",
	warranty: "בדק ואחריות",
	other: "אחר"
}, vn = {
	hours: "שעות",
	working_days: "ימי עבודה",
	calendar_days: "ימים",
	weeks: "שבועות",
	months: "חודשים"
}, yn = {
	event: "אירוע נכנס",
	schedule_task: "נקודה בלוח הקבלן",
	milestone: "אבן דרך אחרת",
	unspecified: "לא הוגדר"
};
function bn(e) {
	if (e.offset_value == null) return "ללא כימות";
	let t = vn[e.offset_unit] ?? e.offset_unit ?? "";
	return `${Number(e.offset_value)} ${t}`.trim();
}
function xn(e) {
	let t = e?.metadata?.contracts_workspace_id, n = e?.source_contract_decision_id;
	if (!t || !n) return null;
	let r = new URLSearchParams({ decisionId: n });
	return e.source_page && r.set("page", String(e.source_page)), `/api/contracts/workspaces/${encodeURIComponent(t)}/source-link?${r}`;
}
var Sn = ({ data: e, expanded: t, onToggle: n, resolvingId: r, onResolve: i, onManualResolve: a, manualDates: o, onManualDateChange: s, rowResults: c }) => {
	let l = e?.conditions ?? [], u = Object.entries(l.reduce((e, t) => ((e[t.category] ||= []).push(t), e), {}));
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		className: "condBox",
		children: [/* @__PURE__ */ (0, x.jsxs)("button", {
			type: "button",
			className: "condHead",
			onClick: n,
			"aria-expanded": t,
			"aria-controls": "schedule-conditions-body",
			children: [
				/* @__PURE__ */ (0, x.jsxs)("span", {
					className: "condHeadTitle",
					children: ["⏳ פנקס זמנים יחסיים מהחוזה", /* @__PURE__ */ (0, x.jsx)("span", {
						className: "condHeadCount",
						children: l.length
					})]
				}),
				/* @__PURE__ */ (0, x.jsx)("span", {
					className: "condHeadHint",
					children: "כל נקודת זמן שנמשכה מהחוזה, הפעולה שמפעילה אותה והתאריך שנקלט בפועל"
				}),
				/* @__PURE__ */ (0, x.jsx)("span", {
					className: "condChevron",
					children: t ? "▲" : "▼"
				})
			]
		}), t ? /* @__PURE__ */ (0, x.jsxs)("div", {
			id: "schedule-conditions-body",
			className: "condBody",
			children: [/* @__PURE__ */ (0, x.jsx)("div", {
				className: "condResolverBar",
				children: /* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("strong", { children: "אותו שדה — הזנה ידנית היום, השלמה אוטומטית בהמשך" }), /* @__PURE__ */ (0, x.jsx)("span", { children: "בחירת תאריך מפעילה את מנוע הלו״ז הדטרמיניסטי. איתור אוטומטי מחפש את אותו אירוע ב־Gantt, באירועים מזוהים ורק אז ב־RAG." })] })
			}), u.length ? u.map(([e, t]) => /* @__PURE__ */ (0, x.jsxs)("div", {
				className: "condGroup",
				children: [/* @__PURE__ */ (0, x.jsxs)("div", {
					className: "condGroupTitle",
					children: [_n[e] ?? e, /* @__PURE__ */ (0, x.jsx)("span", {
						className: "condGroupCount",
						children: t.length
					})]
				}), /* @__PURE__ */ (0, x.jsx)("div", {
					className: "condTableWrap",
					children: /* @__PURE__ */ (0, x.jsxs)("table", {
						className: "condTable",
						children: [/* @__PURE__ */ (0, x.jsx)("thead", { children: /* @__PURE__ */ (0, x.jsxs)("tr", { children: [
							/* @__PURE__ */ (0, x.jsx)("th", { children: "ההתחייבות החוזית והזמן" }),
							/* @__PURE__ */ (0, x.jsx)("th", { children: "האירוע שמפעיל את הספירה" }),
							/* @__PURE__ */ (0, x.jsx)("th", { children: "תאריך האירוע בפועל" })
						] }) }), /* @__PURE__ */ (0, x.jsx)("tbody", { children: t.map((e) => {
							let t = c?.[e.id], n = r === e.id, l = xn(e), u = e.metadata?.pending_reason, d = o && Object.prototype.hasOwnProperty.call(o, e.id) ? o[e.id] : _t(e.trigger_event_date ?? ""), f = gt(d), p = !!d && !f, m = e.status === "resolved";
							return /* @__PURE__ */ (0, x.jsxs)("tr", {
								className: m ? "is-resolved" : "",
								title: e.source_excerpt,
								children: [
									/* @__PURE__ */ (0, x.jsxs)("td", {
										className: "condContractPoint",
										children: [
											/* @__PURE__ */ (0, x.jsxs)("div", {
												className: "condOffsetLine",
												children: [/* @__PURE__ */ (0, x.jsx)("b", { children: bn(e) }), /* @__PURE__ */ (0, x.jsx)("span", {
													className: `condState is-${e.status}`,
													children: m ? "הושלם" : "ממתין"
												})]
											}),
											/* @__PURE__ */ (0, x.jsx)("strong", {
												className: "condName",
												children: e.name
											}),
											e.metadata?.action_description_he ? /* @__PURE__ */ (0, x.jsxs)("span", {
												className: "condActionDescription",
												children: [
													/* @__PURE__ */ (0, x.jsx)("b", { children: "מה החוזה מחייב:" }),
													" ",
													e.metadata.action_description_he
												]
											}) : null,
											/* @__PURE__ */ (0, x.jsx)("span", {
												className: "condPage",
												children: l ? /* @__PURE__ */ (0, x.jsxs)("a", {
													href: l,
													target: "_blank",
													rel: "noreferrer",
													title: "פתיחת מסמך החוזה בקישור מאובטח קצר־חיים",
													children: [e.metadata?.source_filename || "מסמך החוזה", e.source_page ? ` · עמ׳ ${e.source_page}` : ""]
												}) : e.source_page ? `עמ׳ ${e.source_page}` : "מקור חוזי"
											})
										]
									}),
									/* @__PURE__ */ (0, x.jsxs)("td", {
										className: "condTriggerCell",
										children: [
											/* @__PURE__ */ (0, x.jsx)("strong", { children: e.anchor_description || "האירוע המפעיל טרם תואר" }),
											/* @__PURE__ */ (0, x.jsx)("span", {
												className: `condAnchor is-${e.anchor_kind}`,
												children: yn[e.anchor_kind] ?? e.anchor_kind
											}),
											u ? /* @__PURE__ */ (0, x.jsx)("span", {
												className: "condPendingReason",
												children: u
											}) : null,
											e.source_excerpt ? /* @__PURE__ */ (0, x.jsxs)("details", {
												className: "condSourceExcerpt",
												children: [/* @__PURE__ */ (0, x.jsx)("summary", { children: "הצג ציטוט מהחוזה" }), /* @__PURE__ */ (0, x.jsx)("p", { children: e.source_excerpt })]
											}) : null
										]
									}),
									/* @__PURE__ */ (0, x.jsxs)("td", {
										className: "condDateCell",
										children: [
											/* @__PURE__ */ (0, x.jsxs)("div", {
												className: "condDateEntry",
												children: [/* @__PURE__ */ (0, x.jsx)("input", {
													type: "text",
													inputMode: "numeric",
													dir: "ltr",
													lang: "he-IL",
													placeholder: "dd/mm/yyyy",
													pattern: "[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}",
													value: d,
													disabled: m || !!r,
													"aria-label": `תאריך האירוע בפועל עבור ${e.name}`,
													"aria-invalid": p,
													"aria-describedby": `condition-date-hint-${e.id}`,
													onChange: (t) => s(e.id, t.target.value),
													onBlur: () => {
														f && s(e.id, _t(f));
													}
												}), m ? /* @__PURE__ */ (0, x.jsx)("span", {
													className: "condVerifiedDate",
													children: "תאריך מאומת"
												}) : /* @__PURE__ */ (0, x.jsx)("button", {
													type: "button",
													className: "condManualBtn",
													onClick: () => a(e, f),
													disabled: !f || !!r,
													children: n ? "שומר…" : "שמור וחשב מועד"
												})]
											}),
											/* @__PURE__ */ (0, x.jsx)("span", {
												id: `condition-date-hint-${e.id}`,
												className: `condDateHint ${p ? "is-error" : ""}`,
												children: p ? "יש להזין תאריך תקין בפורמט יום/חודש/שנה" : "פורמט: יום/חודש/שנה"
											}),
											m ? null : /* @__PURE__ */ (0, x.jsx)("button", {
												type: "button",
												className: "condResolveBtn",
												onClick: () => i(e),
												disabled: !!r,
												children: n ? "מנוע הלו״ז מחפש…" : "איתור אוטומטי במנוע הלו״ז"
											}),
											t ? /* @__PURE__ */ (0, x.jsxs)("span", {
												className: `condRowResult is-${t.status}`,
												title: t.reason || t.evidence?.reason || "",
												children: [t.status === "not_found" ? "לא נמצא תאריך" : t.status === "needs_review" ? t.provisionalDueDate ? `מועד משוער: ${_t(t.provisionalDueDate)}` : "נדרשת בדיקה" : t.status === "error" ? t.reason || "החיפוש נכשל" : _t(t.dueDate) || "הושלם", t.errorCode === "openrouter_auth" ? /* @__PURE__ */ (0, x.jsx)("a", {
													className: "condSettingsLink",
													href: "#settings",
													children: "עדכון מפתח בהגדרות"
												}) : null]
											}) : null
										]
									})
								]
							}, e.id);
						}) })]
					})
				})]
			}, e)) : /* @__PURE__ */ (0, x.jsxs)("div", {
				className: "condEmptyState",
				children: [/* @__PURE__ */ (0, x.jsx)("span", {
					className: "condEmptyIcon",
					children: "⌛"
				}), /* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("strong", { children: "התנאים היחסיים טרם סונכרנו למאגר הלו״ז" }), /* @__PURE__ */ (0, x.jsx)("span", { children: "לאחר הפעלת חיבור Indicator הם יופיעו כאן אוטומטית, ללא חילוץ חוזר של החוזה." })] })]
			})]
		}) : null]
	});
}, Cn = ({ alerts: e, expanded: t, onToggle: n }) => {
	let r = e.reduce((e, t) => Math.max(e, Number(t.severity_level) || 0), 0);
	return /* @__PURE__ */ (0, x.jsxs)("section", {
		className: "schedAlertsBox",
		"aria-label": "חריגות והתראות פעילות",
		children: [/* @__PURE__ */ (0, x.jsxs)("button", {
			type: "button",
			className: "schedAlertsHead",
			onClick: n,
			"aria-expanded": t,
			"aria-controls": "schedule-alerts-body",
			children: [
				/* @__PURE__ */ (0, x.jsxs)("span", {
					className: "schedAlertsHeadTitle",
					children: ["חריגות והתראות פעילות", /* @__PURE__ */ (0, x.jsx)("span", {
						className: "schedAlertsCount",
						children: e.length
					})]
				}),
				/* @__PURE__ */ (0, x.jsx)("span", {
					className: "schedAlertsHeadHint",
					children: r ? `החומרה הגבוהה ביותר: ${r}` : "אין חומרה פעילה"
				}),
				/* @__PURE__ */ (0, x.jsx)("span", {
					className: "schedAlertsChevron",
					"aria-hidden": "true",
					children: t ? "▲" : "▼"
				})
			]
		}), t ? /* @__PURE__ */ (0, x.jsx)("div", {
			id: "schedule-alerts-body",
			className: "schedAlerts",
			children: e.map((e) => /* @__PURE__ */ (0, x.jsxs)("article", {
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
		}) : null]
	});
}, wn = ({ health: e }) => {
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
function Tn() {
	let [e, t] = (0, b.useState)([]), [n, r] = (0, b.useState)(""), [i, a] = (0, b.useState)(""), [o, s] = (0, b.useState)(""), [c, l] = (0, b.useState)(!1), [u, d] = (0, b.useState)(""), [f, p] = (0, b.useState)(null), [m, h] = (0, b.useState)(null), [g, _] = (0, b.useState)([]), [v, y] = (0, b.useState)({
		total: 0,
		items: []
	}), [S, C] = (0, b.useState)(null), [w, T] = (0, b.useState)(null), [E, D] = (0, b.useState)({}), [O, k] = (0, b.useState)(null), [A, j] = (0, b.useState)(null), [M, N] = (0, b.useState)(() => Ot()), [P, F] = (0, b.useState)(!1), [I, L] = (0, b.useState)(St), R = (0, b.useRef)({
		token: 0,
		stopRequested: !1,
		active: !1
	}), [z, ee] = (0, b.useState)(null), [te, B] = (0, b.useState)(null), [V, ne] = (0, b.useState)(mt.conditionsOpen), [re, ie] = (0, b.useState)(mt.alertsOpen), [ae, oe] = (0, b.useState)(null), [se, ce] = (0, b.useState)({}), [le, ue] = (0, b.useState)(""), [de, fe] = (0, b.useState)({}), [pe, me] = (0, b.useState)(mt.view), [he, ge] = (0, b.useState)(mt.onlyLate), [_e, ve] = (0, b.useState)(""), [ye, be] = (0, b.useState)(mt.showLateLines), [xe, H] = (0, b.useState)(mt.showAsOfMarker), [Se, Ce] = (0, b.useState)(null), [we, Te] = (0, b.useState)(!1), [Ee, De] = (0, b.useState)(!1), [Oe, ke] = (0, b.useState)(""), [Ae, je] = (0, b.useState)([]), Me = (0, b.useCallback)(async () => {
		let e = await nn("/api/schedule/projects", { timeoutMs: 45e3 });
		return t(e.projects ?? []), e.projects ?? [];
	}, []), U = (0, b.useCallback)(async (e, t, n = "") => {
		if (e) {
			R.current.token += 1, R.current.stopRequested = !1, R.current.active = !1, N(Ot()), Te(!0), ke(""), D({}), k(null), j(null);
			try {
				let r = t || n || "", i = r ? `&asOf=${encodeURIComponent(r)}` : "", a = async (e, t, n) => {
					try {
						return {
							value: await e,
							warning: "",
							error: null,
							label: n
						};
					} catch (e) {
						return {
							value: t,
							warning: `${n}: ${e.message}`,
							error: e,
							label: n
						};
					}
				}, [o, s, c, l, u, d, f] = await Promise.all([
					a(nn(`/api/schedule/health?projectId=${encodeURIComponent(e)}${i}`, { timeoutMs: 45e3 }), null, "טעינת מדדי מצב"),
					a(nn("/api/schedule/sweep", {
						method: "POST",
						body: {
							projectId: e,
							asOf: r || null,
							persist: !1,
							filters: { excludeCompleted: !1 }
						},
						timeoutMs: 45e3
					}), {
						indicators: [],
						warnings: []
					}, "חישוב לוח הזמנים"),
					a(nn(`/api/schedule/alerts?projectId=${encodeURIComponent(e)}&baselined=false&lifecycle=open,updated`, { timeoutMs: 45e3 }), { alerts: [] }, "טעינת התראות"),
					a(nn(`/api/schedule/alerts?projectId=${encodeURIComponent(e)}&baselined=true`, { timeoutMs: 45e3 }), { count: 0 }, "טעינת היסטוריית התראות"),
					a(nn(`/api/schedule/conditions?projectId=${encodeURIComponent(e)}&status=pending,resolved`, { timeoutMs: 45e3 }), { conditions: [] }, "טעינת אבני דרך חוזיות"),
					a(nn(`/api/schedule/activity-updates?projectId=${encodeURIComponent(e)}`, { timeoutMs: 45e3 }), {
						total: 0,
						items: []
					}, "טעינת עדכונים והתראות"),
					a(nn(`/api/schedule/activity-updates/assignment-agent/reviews?projectId=${encodeURIComponent(e)}&status=pending`, { cache: "no-store" }), { reviews: [] }, "טעינת החלטות צוות")
				]), m = o.value, g = s.value, v = c.value, b = l.value, x = u.value, S = d.value, C = f.value;
				k(C.labelCoverage || null), j(Array.isArray(C.shadowValidation?.observedSourceIds) ? C.shadowValidation.observedSourceIds.map((e) => String(e)) : null);
				let w = [o, s].filter((e) => e.error);
				w.length && ke(rn(w)), p(m), h(g), _(v.alerts ?? []), ee(b.count ?? 0), B(x);
				let T = Ht(S.items, C.reviews);
				y({
					total: T.items.length,
					items: T.items
				}), D(T.agentResults), je([...new Set([
					...m?.warnings ?? [],
					...g.warnings ?? [],
					o.warning,
					s.warning,
					c.warning,
					l.warning,
					u.warning,
					d.warning,
					f.warning
				].filter(Boolean))]);
			} catch (e) {
				ke(e.message);
			} finally {
				Te(!1);
			}
		}
	}, []), Ne = (0, b.useCallback)(async () => {
		if (n) {
			l(!0), d(""), ke("");
			try {
				let e = (await nn("/api/schedule/project-end-date", {
					method: "POST",
					body: {
						projectId: n,
						projectEndDate: o || null
					}
				})).projectEndDate || "";
				t((t) => t.map((t) => t.projectId === n ? {
					...t,
					projectEndDate: e || null
				} : t)), d(e ? `תאריך סיום הפרויקט נשמר: ${e}` : "תאריך סיום הפרויקט נוקה; הפרויקט מוגדר כפעיל."), await U(n, i, e);
			} catch (e) {
				ke(e.message);
			} finally {
				l(!1);
			}
		}
	}, [
		n,
		o,
		i,
		U
	]), Pe = (0, b.useCallback)(async (e, t) => {
		if (!(!n || !e?.id)) {
			C(e.id), ke("");
			try {
				let r = await nn("/api/schedule/activity-updates/assign", {
					method: "POST",
					body: {
						projectId: n,
						sourceId: e.id,
						activityKey: t
					}
				});
				y((t) => ({
					...t,
					items: t.items.map((t) => t.id === e.id ? r.item : t)
				})), r.reviewQueueWarning && je((e) => [.../* @__PURE__ */ new Set([...e, `סנכרון החלטת צוות: ${r.reviewQueueWarning}`])]), D((t) => {
					if (!t[e.id]) return t;
					let n = { ...t };
					return delete n[e.id], n;
				});
			} catch (e) {
				ke(e.message);
			} finally {
				C(null);
			}
		}
	}, [n]), Fe = (0, b.useCallback)(async (e, { timeFilter: t = !1, reviewOnly: r = !0 } = {}) => {
		if (!n || !e?.id) return {
			ok: !1,
			error: "חסרים פרויקט או מזהה התראה"
		};
		T(e.id), ke(""), D((t) => ({
			...t,
			[e.id]: null
		}));
		try {
			let i = await nn("/api/schedule/activity-updates/assignment-agent/run", {
				method: "POST",
				body: {
					projectId: n,
					sourceId: e.id,
					...t ? { timeFilter: !0 } : {},
					...r ? { reviewOnly: !0 } : {}
				},
				timeoutMs: 9e5
			});
			return D((t) => ({
				...t,
				[e.id]: i
			})), i.persistedReview && j((t) => Array.isArray(t) && !t.includes(String(e.id)) ? [...t, String(e.id)] : t), i.workflowLog && typeof window.__bidocSetWorkflowFromReact == "function" && window.__bidocSetWorkflowFromReact(i), i.assignment && y((t) => ({
				...t,
				items: t.items.map((t) => t.id === e.id ? i.assignment : t)
			})), {
				ok: !0,
				result: i
			};
		} catch (t) {
			return D((n) => ({
				...n,
				[e.id]: { error: t.message }
			})), {
				ok: !1,
				error: t.message
			};
		} finally {
			T(null);
		}
	}, [n]), Ie = (0, b.useCallback)(async ({ queue: e, startIndex: t = 0, initialStats: n = null, timeFilter: r = !1 }) => {
		if (R.current.active) return;
		if (!e.length || t >= e.length) {
			N(Ot({
				status: bt.COMPLETED,
				queue: e,
				total: e.length,
				nextIndex: e.length,
				processed: Number(n?.processed) || 0,
				assigned: Number(n?.assigned) || 0,
				review: Number(n?.review) || 0,
				skipped: Number(n?.skipped) || 0,
				failed: Number(n?.failed) || 0
			}));
			return;
		}
		let i = R.current.token + 1;
		R.current = {
			token: i,
			stopRequested: !1,
			active: !0
		};
		let a = {
			processed: Number(n?.processed) || 0,
			assigned: Number(n?.assigned) || 0,
			review: Number(n?.review) || 0,
			skipped: Number(n?.skipped) || 0,
			failed: Number(n?.failed) || 0
		}, o = {
			queue: e,
			total: e.length,
			timeFilter: r === !0
		};
		N(Ot({
			...o,
			...a,
			status: bt.RUNNING,
			nextIndex: t,
			currentId: e[t]?.id || null
		}));
		for (let n = t; n < e.length; n += 1) {
			if (R.current.token !== i) return;
			if (R.current.stopRequested) {
				R.current.active = !1, N(Ot({
					...o,
					...a,
					status: bt.PAUSED,
					nextIndex: n
				}));
				return;
			}
			N(Ot({
				...o,
				...a,
				status: bt.RUNNING,
				nextIndex: n,
				currentId: e[n].id
			}));
			let t = await Fe(e[n], {
				timeFilter: r,
				reviewOnly: !0
			});
			if (R.current.token !== i) return;
			a = Ft(a, t);
			let s = n + 1;
			if (R.current.stopRequested) {
				R.current.active = !1, N(Ot({
					...o,
					...a,
					status: s < e.length ? bt.PAUSED : bt.COMPLETED,
					nextIndex: s
				}));
				return;
			}
			s >= e.length && (R.current.active = !1), N(Ot({
				...o,
				...a,
				status: s >= e.length ? bt.COMPLETED : bt.RUNNING,
				nextIndex: s,
				currentId: s < e.length ? e[s].id : null
			}));
		}
	}, [Fe]), Le = (0, b.useCallback)((e) => {
		let t = new Set(e.map((e) => String(e.id)));
		D((e) => Object.fromEntries(Object.entries(e).filter(([e]) => !t.has(String(e)))));
	}, []), Re = (0, b.useCallback)((e = v.items, t = I) => {
		if (!Array.isArray(A)) return;
		let n = { excludedSourceIds: A }, r = At(e, n), i = At(e, {
			...n,
			limit: kt(t)
		});
		if (!i.length) return;
		let a = jt({
			batchSize: i.length,
			eligibleCount: r.length
		});
		typeof window < "u" && !window.confirm(a) || (Le(i), Ie({
			queue: i,
			timeFilter: P
		}));
	}, [
		v.items,
		I,
		P,
		A,
		Le,
		Ie
	]), ze = (0, b.useCallback)(() => {
		M.status === bt.RUNNING && (R.current.stopRequested = !0, N((e) => ({
			...e,
			status: bt.STOPPING
		})));
	}, [M.status]), Be = (0, b.useCallback)(() => {
		M.status === bt.PAUSED && Ie({
			queue: M.queue,
			startIndex: M.nextIndex,
			initialStats: M,
			timeFilter: M.timeFilter
		});
	}, [M, Ie]), Ve = (0, b.useCallback)((e = v.items, t = I) => {
		Re(e, t);
	}, [
		v.items,
		I,
		Re
	]), He = (0, b.useCallback)(async (e, t, r) => {
		if (!(!n || !t?.runId || !r?.activityKey)) {
			T(e.id), ke("");
			try {
				let i = !!(t.persistedReview && t.detachedFromCurrentFeed), a = await nn(i ? "/api/schedule/activity-updates/assignment-agent/review-label" : "/api/schedule/activity-updates/assignment-agent/confirm", {
					method: "POST",
					body: {
						projectId: n,
						runId: t.runId,
						sourceId: e.id,
						activityKey: r.activityKey,
						labelType: "confirmed_match",
						reason: "הבודק אישר את הפעילות המוצעת כתווית כיול."
					}
				});
				i || y((t) => ({
					...t,
					items: t.items.map((t) => t.id === e.id ? a.item : t)
				})), a.reviewQueueWarning && je((e) => [.../* @__PURE__ */ new Set([...e, `סנכרון החלטת צוות: ${a.reviewQueueWarning}`])]), D((n) => ({
					...n,
					[e.id]: {
						...t,
						auditPersisted: !1,
						decision: {
							...t.decision,
							autoAssigned: !1,
							selectedActivityName: r.name,
							rankingScore: r.finalScore,
							calibratedProbability: null,
							calibration: {
								status: "not_applicable",
								probability: null,
								artifactId: null,
								reason: "manual_review"
							},
							confidence: r.finalScore,
							reason: "הצעת הסוכן אושרה ונשמרה."
						},
						approved: !0
					}
				}));
			} catch (n) {
				D((r) => ({
					...r,
					[e.id]: {
						...t,
						error: n.message
					}
				}));
			} finally {
				T(null);
			}
		}
	}, [n]), Ue = (0, b.useCallback)(async (e, t, r = zt[0]) => {
		if (!(!n || !t?.runId)) {
			T(e.id), ke("");
			try {
				let i = await nn(t.auditPersisted && !t.detachedFromCurrentFeed ? "/api/schedule/activity-updates/assignment-agent/reject" : "/api/schedule/activity-updates/assignment-agent/review-label", {
					method: "POST",
					body: {
						projectId: n,
						runId: t.runId,
						sourceId: e.id,
						labelType: r.type,
						reason: r.reasonHe
					}
				});
				i.reviewQueueWarning && je((e) => [.../* @__PURE__ */ new Set([...e, `סנכרון החלטת צוות: ${i.reviewQueueWarning}`])]), D((n) => ({
					...n,
					[e.id]: {
						...t,
						auditPersisted: !1,
						decision: {
							...t.decision,
							reason: r.reasonHe
						},
						evaluationLabelType: r.type,
						rejected: !0
					}
				}));
			} catch (n) {
				D((r) => ({
					...r,
					[e.id]: {
						...t,
						error: n.message
					}
				}));
			} finally {
				T(null);
			}
		}
	}, [n]), We = (0, b.useCallback)(async () => {
		if (n) {
			De(!0), ke("");
			try {
				await nn("/api/schedule/alert-scan", {
					method: "POST",
					body: {
						projectId: n,
						asOf: i || o || null
					},
					timeoutMs: 24e4
				}), await U(n, i, o);
			} catch (e) {
				ke(e.message);
			} finally {
				De(!1);
			}
		}
	}, [
		n,
		i,
		o,
		U
	]), Ge = (0, b.useCallback)(async (e, t = null) => {
		if (!(!n || !e?.id)) {
			oe(e.id), ke(""), ue("");
			try {
				let r = (await nn("/api/schedule/conditions/resolve", {
					method: "POST",
					body: {
						projectId: n,
						conditionId: e.id,
						commit: !0,
						minConfidence: .8,
						...t ? { manualTriggerDate: t } : {}
					},
					timeoutMs: 9e5
				})).results?.[0] ?? {
					status: "error",
					reason: "הסוכן לא החזיר תוצאה"
				};
				if (ce((t) => ({
					...t,
					[e.id]: r
				})), r.status === "resolved") ue(`הושלם: ${e.name} — האירוע ${r.evidence?.triggerDate || t || "אותר"}, והמועד החוזי ${r.dueDate} נשמר.`), await U(n, i, o);
				else if (r.triggerSaved) {
					let e = r.provisionalDueDate ? ` מועד משוער ${r.provisionalDueDate} סומן בדגלון כתום על הציר.` : "";
					ue(`תאריך האירוע ${r.evidence?.triggerDate || t} נשמר.${e} המועד החוזי הסופי ממתין להשלמת לוח ימי העבודה והחגים.`), await U(n, i, o);
				}
			} catch (t) {
				ce((n) => ({
					...n,
					[e.id]: {
						status: "error",
						reason: t.message
					}
				})), ke(t.message);
			} finally {
				oe(null);
			}
		}
	}, [
		n,
		i,
		o,
		U
	]);
	(0, b.useEffect)(() => {
		let e = !1;
		return Me().then((t) => {
			e || !t.length || (r((e) => e || t[0].projectId), s((e) => e || t[0].projectEndDate || ""));
		}).catch((e) => ke(e.message)), () => {
			e = !0;
		};
	}, [Me]), (0, b.useEffect)(() => () => {
		R.current.token += 1, R.current.stopRequested = !0, R.current.active = !1;
	}, []), (0, b.useEffect)(() => {
		if (!n) return;
		location.hash === "#schedule" && U(n, i, o);
		let e = () => U(n, i, o);
		return window.addEventListener("bidoc:schedule-activated", e), () => window.removeEventListener("bidoc:schedule-activated", e);
	}, [
		n,
		i,
		o,
		U
	]);
	let Ke = (0, b.useMemo)(() => [...(m?.indicators ?? []).filter((e) => !(he && e.lateness?.isLate !== !0 || _e && !(e.lateness?.daysLate >= Number(_e))))].sort((e, t) => Number(t.subject.kind === "milestone") - Number(e.subject.kind === "milestone")), [
		m,
		he,
		_e
	]), qe = m?.scheduleMeta, Je = (0, b.useMemo)(() => {
		let e = (e) => {
			let t = String(e || "").match(/^(\d{4})-(\d{2})-(\d{2})$/u);
			return t ? `${t[3]}.${t[2]}.${t[1].slice(2)}` : "ללא תאריך";
		}, t = /* @__PURE__ */ new Map();
		for (let n of m?.indicators ?? []) {
			let r = n.subject?.activityKey;
			if (r && !t.has(r)) {
				let i = n.timing?.plannedStart, a = n.timing?.plannedFinish;
				t.set(r, {
					key: r,
					name: n.subject?.name || r,
					start: i || "",
					dateLabel: i || a ? `${e(i)}–${e(a)}` : "ללא תאריכי תכנון"
				});
			}
		}
		return [...t.values()].sort((e, t) => e.name.localeCompare(t.name, "he") || e.start.localeCompare(t.start));
	}, [m]), Ye = (0, b.useMemo)(() => {
		let e = m?.indicators ?? [];
		if (!e.length) return null;
		let t = {
			ok: 2,
			stale: 1,
			missing: 0
		}, n = {};
		for (let r of Object.keys($t)) r === "scheduleVersions" ? n[r] = Math.max(...e.map((e) => Number(e.gates?.scheduleVersions) || 0)) : n[r] = e.reduce((e, n) => (t[n.gates?.[r]] ?? 0) > (t[e] ?? 0) ? n.gates[r] : e, "missing");
		return n;
	}, [m]);
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		className: "schedulePage",
		dir: "rtl",
		children: [
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "schedToolbar",
				children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("h2", {
					className: "schedTitle",
					children: "לוח זמנים — שלושת הצירים"
				}), qe ? /* @__PURE__ */ (0, x.jsxs)("div", {
					className: "schedSubtitle",
					children: [
						"נכון ל-",
						/* @__PURE__ */ (0, x.jsx)("b", { children: m.asOf }),
						" · מקור: ",
						/* @__PURE__ */ (0, x.jsx)("b", { children: qe.displayName ?? qe.sourceVersionId }),
						" (Data Date: ",
						qe.relevancyDate ?? "?",
						") · ",
						qe.versionCount,
						" ",
						qe.versionCount === 1 ? "גרסה" : "גרסאות"
					]
				}) : null] }), /* @__PURE__ */ (0, x.jsxs)("div", {
					className: "schedControls",
					children: [
						/* @__PURE__ */ (0, x.jsxs)("select", {
							value: n,
							"aria-label": "בחירת פרויקט",
							onChange: (t) => {
								let n = t.target.value;
								r(n), s(e.find((e) => e.projectId === n)?.projectEndDate || ""), d("");
							},
							className: "schedSelect",
							children: [!e.length && /* @__PURE__ */ (0, x.jsx)("option", {
								value: "",
								children: "אין לוחות זמנים"
							}), e.map((e) => /* @__PURE__ */ (0, x.jsxs)("option", {
								value: e.projectId,
								children: [
									e.name || `${e.projectId.slice(0, 8)}…`,
									" (",
									e.files,
									" קבצים, עדכני ל-",
									e.latestRelevancyDate ?? "?",
									")"
								]
							}, e.projectId))]
						}),
						/* @__PURE__ */ (0, x.jsxs)("label", {
							className: "schedDateField",
							htmlFor: "schedule-as-of",
							children: ["נכון ל־", /* @__PURE__ */ (0, x.jsx)("input", {
								id: "schedule-as-of",
								type: "date",
								value: i,
								onChange: (e) => a(e.target.value),
								className: "schedDate",
								title: "ריק = תאריך סיום הפרויקט, או היום בפרויקט פעיל"
							})]
						}),
						/* @__PURE__ */ (0, x.jsx)("button", {
							type: "button",
							className: "schedBtn",
							onClick: () => U(n, i, o),
							disabled: we || !n,
							children: we ? "טוען…" : "רענן"
						}),
						/* @__PURE__ */ (0, x.jsx)("button", {
							type: "button",
							className: "schedBtn schedBtnPrimary",
							onClick: We,
							disabled: Ee || !n,
							title: "סריקה מלאה: חישוב אינדיקטורים, שמירת Snapshots ועדכון התראות",
							children: Ee ? "סורק…" : "סריקת התראות"
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "schedProjectEndControl",
				children: [
					/* @__PURE__ */ (0, x.jsx)("label", {
						htmlFor: "schedule-project-end",
						children: "תאריך סיום הפרויקט"
					}),
					/* @__PURE__ */ (0, x.jsx)("input", {
						id: "schedule-project-end",
						type: "date",
						value: o,
						onChange: (e) => {
							s(e.target.value), d("");
						},
						disabled: !n || c
					}),
					/* @__PURE__ */ (0, x.jsx)("button", {
						type: "button",
						className: "schedBtn",
						onClick: Ne,
						disabled: !n || c,
						children: c ? "שומר…" : "שמור תאריך סיום"
					}),
					/* @__PURE__ */ (0, x.jsx)("span", { children: "ריק = פרויקט פעיל. התאריך השמור עוצר את חישוב האיחור בפרויקטים שהסתיימו." }),
					u ? /* @__PURE__ */ (0, x.jsx)("strong", {
						role: "status",
						children: u
					}) : null
				]
			}),
			Ye ? /* @__PURE__ */ (0, x.jsx)(ln, {
				gates: Ye,
				compact: !0
			}) : null,
			Oe ? /* @__PURE__ */ (0, x.jsxs)("div", {
				className: "schedError",
				role: "alert",
				children: [/* @__PURE__ */ (0, x.jsx)("span", { children: Oe }), /* @__PURE__ */ (0, x.jsx)("button", {
					type: "button",
					className: "schedBtn",
					onClick: () => U(n, i, o),
					disabled: we || !n,
					children: we ? "מנסה שוב…" : "נסה שוב"
				})]
			}) : null,
			Ae.length ? /* @__PURE__ */ (0, x.jsx)("div", {
				className: "schedWarnings",
				children: Ae.map((e) => /* @__PURE__ */ (0, x.jsxs)("div", { children: ["⚠ ", e] }, e))
			}) : null,
			/* @__PURE__ */ (0, x.jsx)(wn, { health: f }),
			g.length ? /* @__PURE__ */ (0, x.jsx)(Cn, {
				alerts: g,
				expanded: re,
				onToggle: () => ie((e) => !e)
			}) : null,
			z ? /* @__PURE__ */ (0, x.jsxs)("div", {
				className: "schedBaselinedNote",
				children: [z, " חריגות סומנו baselined באתחול ההיסטורי — גלויות בצירים למטה, ולא ייצרו התראה עד החמרה מהותית."]
			}) : null,
			le ? /* @__PURE__ */ (0, x.jsx)("div", {
				className: "condResolverResult",
				role: "status",
				children: le
			}) : null,
			/* @__PURE__ */ (0, x.jsx)(Sn, {
				data: te,
				expanded: V,
				onToggle: () => ne((e) => !e),
				resolvingId: ae,
				onResolve: Ge,
				onManualResolve: Ge,
				manualDates: de,
				onManualDateChange: (e, t) => fe((n) => ({
					...n,
					[e]: t
				})),
				rowResults: se
			}),
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "schedFilters",
				children: [
					/* @__PURE__ */ (0, x.jsxs)("div", {
						className: "schedViewToggle",
						children: [/* @__PURE__ */ (0, x.jsx)("button", {
							type: "button",
							className: pe === "axes" ? "is-active" : "",
							onClick: () => me("axes"),
							children: "צירים"
						}), /* @__PURE__ */ (0, x.jsx)("button", {
							type: "button",
							className: pe === "table" ? "is-active" : "",
							onClick: () => me("table"),
							children: "טבלה"
						})]
					}),
					/* @__PURE__ */ (0, x.jsxs)("label", { children: [/* @__PURE__ */ (0, x.jsx)("input", {
						type: "checkbox",
						checked: he,
						onChange: (e) => ge(e.target.checked)
					}), " רק באיחור"] }),
					/* @__PURE__ */ (0, x.jsx)("button", {
						type: "button",
						className: `schedLateLinesToggle ${ye ? "is-active" : ""}`,
						"aria-pressed": ye,
						disabled: !xe,
						onClick: () => be((e) => !e),
						children: ye ? "הסתר קווי איחור אדומים" : "הצג קווי איחור אדומים"
					}),
					/* @__PURE__ */ (0, x.jsx)("button", {
						type: "button",
						className: `schedAsOfToggle ${xe ? "is-active" : ""}`,
						"aria-pressed": xe,
						onClick: () => H((e) => !e),
						title: "בהסתרה, הציר מצטמצם מהפעילות הראשונה עד הסמן האחרון בלוח הזמנים",
						children: xe ? "הסתר נכון ל־ וצמצם ציר" : "הצג נכון ל־"
					}),
					/* @__PURE__ */ (0, x.jsxs)("label", { children: ["מינימום ימי איחור: ", /* @__PURE__ */ (0, x.jsx)("input", {
						type: "number",
						min: "1",
						value: _e,
						onChange: (e) => ve(e.target.value),
						className: "schedNum"
					})] }),
					/* @__PURE__ */ (0, x.jsxs)("span", {
						className: "schedCount",
						children: [Ke.length, " פעילויות"]
					})
				]
			}),
			pe === "axes" ? /* @__PURE__ */ (0, x.jsx)(pn, {
				indicators: Ke,
				allIndicators: m?.indicators,
				pendingConditions: te?.conditions,
				timelineItems: v.items,
				asOf: m?.asOf,
				showLateLines: ye,
				showAsOfMarker: xe,
				selected: Se,
				onSelect: Ce
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
					] }) }), /* @__PURE__ */ (0, x.jsxs)("tbody", { children: [Ke.map((e) => /* @__PURE__ */ (0, x.jsxs)("tr", {
						onClick: () => Ce(e),
						className: yt(Se) === yt(e) ? "is-selected" : "",
						children: [
							/* @__PURE__ */ (0, x.jsxs)("td", {
								className: "schedName",
								children: [e.subject.name, e.subject.isMilestone ? " ◆" : ""]
							}),
							/* @__PURE__ */ (0, x.jsx)("td", { children: /* @__PURE__ */ (0, x.jsx)(sn, { status: e.status }) }),
							/* @__PURE__ */ (0, x.jsx)("td", { children: an(e.lateness) }),
							/* @__PURE__ */ (0, x.jsx)("td", {
								className: "schedBasis",
								children: on(e.lateness)
							}),
							/* @__PURE__ */ (0, x.jsx)("td", { children: e.timing?.percentComplete ?? "—" }),
							/* @__PURE__ */ (0, x.jsx)("td", { children: /* @__PURE__ */ (0, x.jsx)(cn, { confidence: e.confidence }) }),
							/* @__PURE__ */ (0, x.jsx)("td", { children: e.severity ?? "—" })
						]
					}, yt(e))), !Ke.length && !we ? /* @__PURE__ */ (0, x.jsx)("tr", { children: /* @__PURE__ */ (0, x.jsx)("td", {
						colSpan: 7,
						className: "schedEmpty",
						children: "אין פעילויות תואמות לפילטר"
					}) }) : null] })]
				})
			}),
			/* @__PURE__ */ (0, x.jsx)(gn, {
				indicator: Se,
				onClose: () => Ce(null)
			}),
			/* @__PURE__ */ (0, x.jsx)(hn, {
				items: v.items,
				activities: Je,
				busyId: S,
				onAssign: Pe,
				agentBusyId: w,
				agentResults: E,
				onRunAgent: Fe,
				onConfirmAgent: He,
				onRejectAgent: Ue,
				agentBatch: M,
				onStartAgentBatch: Re,
				onStopAgentBatch: ze,
				onResumeAgentBatch: Be,
				onRestartAgentBatch: Ve,
				timeFilterEnabled: P,
				onTimeFilterChange: F,
				batchLimit: I,
				onBatchLimitChange: L,
				labelCoverage: O,
				shadowObservedSourceIds: A
			})
		]
	});
}
//#endregion
//#region src/contracts/reviewMode.js
var En = Object.freeze({
	promotion: "promotion",
	reviewOnly: "review_only",
	blocked: "blocked"
});
function Dn(e) {
	if (!e || typeof e != "object") return En.blocked;
	let t = Array.isArray(e.globalBlockers) ? e.globalBlockers : [], n = Array.isArray(e.candidatePlans) ? e.candidatePlans : [];
	if (t.length || n.length === 0) return En.blocked;
	if (e.transactionReady === !0) {
		let e = n.some((e) => e?.status === "transaction_ready"), t = n.some((e) => !["transaction_ready", "rejected"].includes(e?.status));
		return e && !t ? En.promotion : En.blocked;
	}
	return n.every((e) => e?.status === "rejected") ? En.reviewOnly : En.blocked;
}
//#endregion
//#region src/contracts/clausePresentation.js
var On = "contracts-clause-presentation.r3.3.v1", kn = "contracts-relationships-input-boundary.r3.3.v1", An = Object.freeze({
	document_context: "הקשר מסמך",
	clause: "סעיף ראשי",
	subclause: "תת־סעיף",
	appendix_item: "פריט נספח"
}), jn = Object.freeze({
	heading: "כותרת מבנית",
	operative: "הוראה חוזית",
	definition: "הגדרה חוזית",
	context: "הקשר מסמך"
}), Mn = Object.freeze({
	appendix: "נספח",
	approval: "אישור",
	authorization: "הסמכה",
	bond: "ערבות",
	change: "שינוי",
	commercial: "מסחרי",
	communication: "תקשורת",
	compliance: "עמידה בדרישות",
	completion: "השלמה",
	confidentiality: "סודיות",
	coordination: "תיאום",
	definitions: "הגדרות",
	delay: "עיכוב",
	dispute: "מחלוקת",
	document_context: "הקשר מסמך",
	documents: "מסמכים",
	execution: "ביצוע",
	extension: "הארכת מועד",
	insurance: "ביטוח",
	liability: "אחריות משפטית",
	milestone: "אבן דרך",
	notice: "הודעה",
	other: "אחר",
	ownership: "בעלות",
	parties: "צדדים להסכם",
	payment: "תשלום",
	quality: "איכות",
	responsibility: "אחריות",
	safety: "בטיחות",
	schedule: "לוח זמנים",
	scope: "תחולת העבודה",
	storage: "אחסון",
	termination: "סיום ההסכם",
	warranty: "אחריות בדק"
}), Nn = Object.freeze({
	a: "א׳",
	b: "ב׳",
	c: "ג׳",
	d: "ד׳",
	e: "ה׳",
	f: "ו׳",
	g: "ז׳",
	h: "ח׳",
	i: "ט׳",
	j: "י׳",
	k: "כ׳",
	l: "ל׳",
	m: "מ׳",
	n: "נ׳",
	o: "ס׳",
	p: "ע׳",
	q: "פ׳",
	r: "צ׳",
	s: "ק׳",
	t: "ר׳",
	u: "ש׳",
	v: "ת׳"
});
function Pn(e) {
	return An[e] || "רשומת חוזה";
}
function Fn(e) {
	return jn[e] || "רשומת חוזה";
}
function In(e) {
	let t = String(e || "").trim();
	return Mn[t] ? Mn[t] : /[\u0590-\u05ff]/u.test(t) ? t : "תגית חוזית";
}
function Ln(e, t = null) {
	let n = String(e || "").trim(), r = n.match(/^appendix_([a-v])(?:\.(heading|.+))?$/u);
	if (r) {
		let e = Nn[r[1]] || r[1].toUpperCase();
		return !r[2] || r[2] === "heading" ? `כותרת נספח ${e}` : `נספח ${e}, סעיף ${r[2]}`;
	}
	return /^\d+(?:\.\d+)*$/u.test(n) ? `סעיף ${n}` : n.includes(".context.") ? t || "הקשר המסמך" : t || "רשומת חוזה";
}
function Rn(e) {
	return Ln(e);
}
function zn(e = []) {
	let t = Array.isArray(e) ? e : [], n = /* @__PURE__ */ new Map();
	for (let e of t) {
		let t = String(e?.parentClauseKey || "").trim();
		t && n.set(t, (n.get(t) || 0) + 1);
	}
	return t.map((e) => {
		let t = Array.isArray(e?.hashtags) ? e.hashtags : [], r = n.get(String(e?.clauseKey || "")) || 0, i = Hn(e, {
			childCount: r,
			hashtags: t
		}), a = i === "heading" ? Wn(e) : null, o = t.map(In), s = (Array.isArray(e?.crossReferences) ? e.crossReferences : []).map((e) => ({
			...e,
			targetLabelHe: Rn(e?.targetClauseKey)
		})), c = {
			...e,
			childCount: r,
			structuralRole: i,
			structuralRoleLabelHe: Fn(i),
			structuralLeadHe: a,
			relationshipEligible: i === "operative",
			clauseTypeLabelHe: Pn(e?.clauseType),
			displayLabelHe: Ln(e?.clauseKey, e?.clauseTitle),
			tagLabelsHe: o,
			crossReferences: s
		};
		return {
			...c,
			displayContentHe: Vn(c)
		};
	});
}
function Bn(e = {}) {
	let t = zn(e?.clauses), n = t.reduce((e, t) => (e[t.structuralRole] = (e[t.structuralRole] || 0) + 1, e), {
		heading: 0,
		operative: 0,
		definition: 0,
		context: 0
	}), r = Object.fromEntries([
		"heading",
		"definition",
		"context"
	].map((e) => [e, t.filter((t) => t.structuralRole === e).map((e) => e.clauseKey)]));
	return {
		...e,
		presentationVersion: On,
		clauses: t,
		coverage: {
			...e?.coverage || {},
			operativeCount: n.operative,
			headingCount: n.heading,
			definitionCount: n.definition,
			contextCount: n.context
		},
		quality: {
			...e?.quality || {},
			roleCounts: n
		},
		relationshipsInputBoundary: {
			version: kn,
			eligibleClauseKeys: t.filter((e) => e.relationshipEligible).map((e) => e.clauseKey),
			excludedClauseKeysByRole: r
		}
	};
}
function Vn(e = {}) {
	let t = e.pageStart === e.pageEnd ? `עמוד ${e.pageStart}` : `עמודים ${e.pageStart}–${e.pageEnd}`;
	return [
		"מקור: מסמכי החוזה",
		e.displayLabelHe || Ln(e.clauseKey, e.clauseTitle),
		`סוג רשומה: ${e.clauseTypeLabelHe || Pn(e.clauseType)}`,
		`תפקיד במסמך: ${e.structuralRoleLabelHe || Fn(e.structuralRole)}`,
		t,
		e.clauseTitle ? `כותרת: ${e.clauseTitle}` : null,
		e.summaryHe ? `תקציר: ${e.summaryHe}` : null,
		e.tagLabelsHe?.length ? `תגיות: ${e.tagLabelsHe.join(" · ")}` : null,
		e.crossReferences?.length ? `הפניות מפורשות: ${e.crossReferences.map((e) => e.referenceText).join(" | ")}` : null,
		e.rawText ? `טקסט מקורי:\n${e.rawText}` : null
	].filter(Boolean).join("\n");
}
function Hn(e, { childCount: t, hashtags: n }) {
	let r = String(e?.clauseType || "");
	return String(e?.clauseKey || "").endsWith(".heading") ? "heading" : r === "document_context" ? "context" : Un(e, t) ? "heading" : n.includes("definitions") ? "definition" : "operative";
}
function Un(e, t) {
	return e?.clauseType === "clause" && t > 0 && !!String(e?.clauseTitle || "").trim();
}
function Wn(e) {
	let t = String(e?.rawText || "").split(/\r?\n/u).map((e) => e.trim()).filter(Boolean);
	return t.length > 1 ? t.slice(1).join(" ") : null;
}
//#endregion
//#region src/contracts/relationshipProposals.js
var Gn = "contracts-relationships-agent.r4.0.v1", Kn = "contracts-relationships-explicit-reference.r4.0.v1", qn = Object.freeze({
	cross_reference: "הפניה מפורשת",
	supports_same_decision: "תומך באותה החלטה",
	depends_on: "תלוי ב־",
	condition_of: "תנאי של",
	exception_to: "חריג ל־",
	amends: "מתקן את",
	duplicates: "כפילות של",
	conflicts_with: "סותר את",
	split_into: "פוצלה אל",
	merged_into: "מוזגה אל"
}), Jn = Object.freeze({
	explicit_reference: "הפניה שכתובה בחוזה",
	deterministic: "כלל דטרמיניסטי",
	model: "הצעת מודל",
	human: "החלטת סוקר",
	system: "פעולת מערכת"
}), Yn = Object.freeze({
	proposed: "מוצע לסקירה",
	approved: "אושר",
	corrected: "תוקן ואושר",
	rejected: "נדחה",
	superseded: "הוחלף",
	unresolved: "לא פתור"
});
function Xn(e) {
	return qn[e] || "קשר חוזי";
}
function Zn(e) {
	return Jn[e] || "מקור קשר לא ידוע";
}
function Qn(e) {
	return Yn[e] || "ממתין לסקירה";
}
function $n(e = {}) {
	let t = zn(e?.clauses), n = new Map(t.map((e) => [String(e.clauseKey || ""), e])), r = /* @__PURE__ */ new Map(), i = [], a = 0;
	for (let e of t) for (let t of Array.isArray(e.crossReferences) ? e.crossReferences : []) {
		a += 1;
		let o = String(t?.targetClauseKey || "").trim(), s = n.get(o);
		if (t?.resolution !== "resolved" || !s || o === e.clauseKey) {
			i.push({
				sourceClauseKey: e.clauseKey,
				sourceLabelHe: e.displayLabelHe || Ln(e.clauseKey, e.clauseTitle),
				targetClauseKey: o,
				targetLabelHe: t?.targetLabelHe || Rn(o),
				referenceText: String(t?.referenceText || "").trim(),
				referenceKind: t?.referenceKind || "clause",
				reason: o === e.clauseKey ? "self_reference" : "target_missing",
				reasonHe: o === e.clauseKey ? "ההפניה מצביעה לאותה רשומה ולכן לא נוצר קשר עצמי." : "יעד ההפניה לא נמצא בגרסת החוזה שנשמרה."
			});
			continue;
		}
		let c = `${e.clauseKey}\u001f${s.clauseKey}\u001fcross_reference`, l = r.get(c);
		if (l) {
			l.referenceTexts.includes(t.referenceText) || l.referenceTexts.push(t.referenceText), l.referenceKinds.includes(t.referenceKind) || l.referenceKinds.push(t.referenceKind);
			continue;
		}
		r.set(c, {
			proposalKey: c,
			relationshipType: "cross_reference",
			relationshipTypeLabelHe: Xn("cross_reference"),
			origin: "explicit_reference",
			originLabelHe: Zn("explicit_reference"),
			confidence: null,
			reviewStatus: "proposed",
			reviewStatusLabelHe: Qn("proposed"),
			sourceClauseKey: e.clauseKey,
			sourceLabelHe: e.displayLabelHe || Ln(e.clauseKey, e.clauseTitle),
			sourceSummaryHe: e.summaryHe,
			sourcePageStart: e.pageStart,
			sourcePageEnd: e.pageEnd,
			sourceRawText: e.rawText,
			sourceRawTextSha256: e.rawTextSha256,
			targetClauseKey: s.clauseKey,
			targetLabelHe: s.displayLabelHe || Ln(s.clauseKey, s.clauseTitle),
			targetSummaryHe: s.summaryHe,
			targetPageStart: s.pageStart,
			targetPageEnd: s.pageEnd,
			targetRawText: s.rawText,
			targetRawTextSha256: s.rawTextSha256,
			referenceTexts: [t.referenceText],
			referenceKinds: [t.referenceKind],
			rationaleHe: `ב${e.displayLabelHe || Ln(e.clauseKey, e.clauseTitle)} נמצאה הפניה מפורשת אל ${s.displayLabelHe || Ln(s.clauseKey, s.clauseTitle)}. הקשר מתעד את ההפניה בלבד ואינו מוכיח ששתי הרשומות שייכות לאותה החלטה.`
		});
	}
	let o = [...r.values()].map((e) => ({
		...e,
		referenceTexts: [...e.referenceTexts].sort((e, t) => e.localeCompare(t, "he")),
		referenceKinds: [...e.referenceKinds].sort()
	}));
	return {
		agentVersion: Gn,
		relationshipPolicyVersion: Kn,
		scope: "explicit_references_only",
		proposals: o,
		unresolvedReferences: i,
		metrics: {
			explicitReferenceCount: a,
			explicitRelationshipCount: o.length,
			unresolvedReferenceCount: i.length,
			modelRelationshipCount: 0,
			decisionCount: 0,
			scheduleWriteCount: 0
		},
		gates: {
			modelGroupingEnabled: !1,
			decisionCreationEnabled: !1,
			conflictResolutionEnabled: !1,
			scheduleWritesEnabled: !1
		}
	};
}
//#endregion
//#region src/react/contractsHebrew.js
var er = Object.freeze({
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
}), tr = Object.freeze({
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
}), nr = Object.freeze({
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
}), rr = Object.freeze({
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
}), ir = Object.freeze({
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
}), ar = Object.freeze({
	reviewed_indicator_impact: "החלטה חוזית שנבדקה וסומנה כרלוונטית ל־Indicator",
	no_indicator_impact: "החלטה חוזית שנבדקה ואינה דורשת טיפול של Indicator",
	indicator_suitability_unknown: "ההתאמה ל־Indicator טרם הוכרעה בסקירת ההחלטה",
	indicator_suitability_invalid: "ערך ההתאמה ל־Indicator אינו תקין",
	decision_embedding_missing: "וקטור ההחלטה עדיין חסר ולכן היא אינה מוכנה למסירה ל־Indicator",
	decision_not_reviewed: "ההחלטה עדיין אינה בגרסת אישור או תיקון סופית",
	decision_inactive: "החלטה שנדחתה, פוצלה, מוזגה או הוחלפה אינה נמסרת ל־Indicator",
	decision_conflict_unresolved: "ההחלטה מכילה סתירה שלא הוכרעה",
	decision_conflict_not_reviewed: "זוהתה סתירה שטרם סומנה כבדוקה"
}), or = Object.freeze({
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
	contracts_workspace_database_override_rejected: "הבקשה נדחתה משום שניסתה לשנות את חיבור מאגר החוזים שבבעלות השרת.",
	contracts_clause_persistence_not_enabled: "שמירת כל תוצאת סוכן החוזים עדיין אינה מופעלת בצד השרת.",
	contracts_clause_persistence_not_found: "חילוץ הסעיפים השמור לא נמצא או שאינו זמין עוד.",
	contracts_clause_persistence_timeout: "שמירת חילוץ הסעיפים חרגה ממגבלת הזמן. אפשר לרענן את רשימת החילוצים ולבדוק אם נשמר.",
	contracts_clause_persistence_response_invalid: "השמירה הושלמה אך תוצאת חילוץ הסעיפים שחזרה ממאגר הנתונים אינה תקינה. יש לבדוק את לוג השרת.",
	contracts_clause_persistence_storage_upload_failed: "שמירת קובץ ה־PDF הפרטי נכשלה, ולכן חילוץ הסעיפים לא נרשם.",
	contracts_clause_persistence_database_override_rejected: "הבקשה נדחתה משום שניסתה לשנות את חיבור מאגר חילוצי הסעיפים שבבעלות השרת.",
	contracts_relationships_not_enabled: "שמירת הצעות הקשר של סוכן הקשרים עדיין אינה מופעלת בצד השרת.",
	contracts_relationships_workspace_not_found: "חילוץ הסעיפים השמור שעליו מבוסס סוכן הקשרים לא נמצא.",
	contracts_relationships_request_invalid: "בקשת סוכן הקשרים אינה תקינה.",
	contracts_relationships_response_invalid: "תוצאת סוכן הקשרים שחזרה ממאגר הנתונים אינה תקינה. יש לבדוק את לוג השרת.",
	contracts_relationships_database_override_rejected: "הבקשה נדחתה משום שניסתה לשנות את חיבור מאגר הקשרים שבבעלות השרת.",
	contracts_relationship_review_not_enabled: "שמירת הצעות הקשר וסקירת R4.2A עדיין אינן מופעלות בצד השרת.",
	contracts_relationship_review_migration_missing: "מיגרציית R4.2A לשמירת הצעות קשר וסקירתן עדיין אינה זמינה ב־KAPAIM.",
	contracts_relationship_review_workspace_not_found: "חילוץ הסעיפים השמור שעליו מבוססת סקירת הקשרים לא נמצא.",
	contracts_relationship_review_request_invalid: "החלטת סקירת הקשר אינה תקינה. יש להשלים נימוק בעברית ולבדוק את פרטי התיקון.",
	contracts_relationship_review_analysis_incomplete: "הניתוח לא נשמר משום שסיווג או בדיקה ספקנית לא הושלמו לכל הזוגות. אפשר להריץ שוב.",
	contracts_relationship_review_stale: "הצעת הקשר השתנתה בחלון אחר. הרשימה העדכנית נטענה בלי לדרוס את ההחלטה החדשה יותר.",
	contracts_relationship_review_conflict: "התיקון מתנגש בקשר קיים או בגרסה חדשה יותר. יש לרענן ולבדוק את הרשימה.",
	contracts_relationship_review_rpc_failed: "מאגר KAPAIM דחה את שמירת סקירת הקשר. פרטי הדחייה נרשמו בטרמינל השרת.",
	contracts_relationship_review_response_invalid: "תוצאת סקירת הקשרים שחזרה מ־KAPAIM אינה תקינה. יש לבדוק את לוג השרת.",
	contracts_relationship_auto_review_not_enabled: "האישור האוטומטי דורש שמסלול סקירת הקשרים R4.2A יהיה פעיל בשרת.",
	contracts_relationship_auto_review_migration_missing: "מיגרציית R4.2A.1 לאישור אוטומטי בטוח עדיין אינה זמינה ב־KAPAIM.",
	contracts_relationship_auto_review_request_invalid: "בקשת האישור האוטומטי אינה תקינה. השרת אינו מקבל קשרים, ספים או החלטות מהדפדפן.",
	contracts_relationship_auto_review_stale: "אחד הקשרים השתנה בזמן האישור האוטומטי. הרשימה העדכנית נטענה בלי לדרוס החלטה חדשה יותר.",
	contracts_relationship_auto_review_rpc_failed: "KAPAIM דחה את האישור האוטומטי. לא בוצעו דחיות, תיקונים או כתיבות ללוח הזמנים.",
	contracts_relationship_auto_review_response_invalid: "תוצאת האישור האוטומטי שחזרה מ־KAPAIM אינה תקינה. יש לבדוק את לוג השרת.",
	contracts_decisions_database_override_rejected: "הבקשה נדחתה משום שניסתה לשנות את חיבור מאגר ההחלטות שבבעלות השרת.",
	contracts_decision_review_not_enabled: "יצירת הצעות החלטה וסקירת R4.2B עדיין אינן מופעלות בצד השרת.",
	contracts_decision_review_migration_missing: "מיגרציית R4.2B להצעות החלטה ולסקירתן עדיין אינה זמינה ב־KAPAIM.",
	contracts_decision_review_workspace_not_found: "חילוץ הסעיפים השמור שעליו מבוססות הצעות ההחלטה לא נמצא.",
	contracts_decision_review_request_invalid: "החלטת הסקירה אינה תקינה. יש להשלים נימוק בעברית ולבדוק את פרטי התיקון.",
	contracts_decision_review_stale: "הצעת ההחלטה השתנתה בחלון אחר. הרשימה העדכנית נטענה בלי לדרוס את ההחלטה החדשה יותר.",
	contracts_decision_review_conflict: "הסקירה מתנגשת בהחלטה קיימת או בגרסה חדשה יותר. יש לרענן ולבדוק את הרשימה.",
	contracts_decision_review_rpc_failed: "מאגר KAPAIM דחה את שמירת הצעת ההחלטה או הסקירה. פרטי הדחייה נרשמו בטרמינל השרת.",
	contracts_decision_review_response_invalid: "תוצאת סקירת ההחלטות שחזרה מ־KAPAIM אינה תקינה. יש לבדוק את לוג השרת.",
	contracts_decision_auto_review_not_enabled: "האישור האוטומטי דורש שמסלולי R4.2B ו־R6 יהיו פעילים בשרת.",
	contracts_decision_auto_review_migration_missing: "מיגרציית R4.2B.1 לאישור אוטומטי בטוח עדיין אינה זמינה ב־KAPAIM.",
	contracts_decision_auto_review_request_invalid: "בקשת האישור האוטומטי אינה תקינה. השרת אינו מקבל החלטות, ספים, ראיות או הגדרות מודל מהדפדפן.",
	contracts_decision_auto_review_unavailable: "מפתח המודל לבודק ההחלטות העצמאי אינו זמין בצד השרת.",
	contracts_decision_auto_review_stale: "אחת ההחלטות השתנתה בזמן האישור האוטומטי. הרשימה העדכנית נטענה בלי לדרוס החלטה חדשה יותר.",
	contracts_decision_auto_review_rpc_failed: "KAPAIM דחה את האישור האוטומטי. לא בוצעו דחיות, תיקונים, מסירות ל־Indicator או כתיבות ללוח הזמנים.",
	contracts_decision_auto_review_response_invalid: "תוצאת האישור האוטומטי שחזרה מ־KAPAIM אינה תקינה. יש לבדוק את לוג השרת.",
	contracts_decision_relationship_review_incomplete: "יש לסיים את הסקירה של כל קשרי R4.2A לפני יצירת הצעות החלטה.",
	contracts_decision_normalization_input_invalid: "הסעיפים או הקשרים השמורים אינם מתאימים ליצירת הצעות החלטה בטוחה.",
	contracts_decision_normalization_unavailable: "מפתח המודל של סוכן ההחלטות אינו זמין בצד השרת.",
	contracts_decision_normalization_token_budget_exceeded: "החוזה חרג מתקציב הניתוח הבטוח של R4.2B. לא נשמרה תוצאה חלקית.",
	contracts_decision_normalization_time_budget_exceeded: "יצירת הצעות ההחלטה חרגה ממגבלת הזמן. לא נשמרה תוצאה חלקית; אפשר לנסות שוב.",
	contracts_decision_normalization_provider_failed: "ספק הבינה המלאכותית לא השלים את יצירת הצעות ההחלטה. לא נשמרה תוצאה חלקית.",
	contracts_decision_normalization_output_invalid: "המודל החזיר הצעת החלטה שאינה עומדת בכללי R4.2B. לא נשמרה תוצאה חלקית.",
	contracts_decision_normalization_incomplete: "הניתוח לא נשמר משום שלא הושלמה הצעת החלטה תקינה לכל קבוצת סעיפים.",
	contracts_decision_normalization_ungrounded_party: "המודל ציין גורם שאינו מופיע בסעיפי המקור. ההצעה נדחתה ולא נשמרה.",
	contracts_decision_normalization_temporal_invalid: "המודל החזיר כלל זמנים שאינו מעוגן במלואו בסעיפי המקור. ההצעה נדחתה.",
	contracts_decision_normalization_ungrounded_numeric_fact: "המודל הוסיף פרט מספרי שאינו מופיע בסעיפי המקור. ההצעה נדחתה ולא נשמרה.",
	contracts_decision_lineage_not_enabled: "פעולות הפיצול והמיזוג של R4.2C עדיין אינן מופעלות בצד השרת.",
	contracts_decision_lineage_migration_missing: "מיגרציית R4.2C לפיצול, מיזוג ושמירת יוחסין עדיין אינה זמינה ב־KAPAIM.",
	contracts_decision_lineage_workspace_not_found: "חילוץ הסעיפים השמור שעליו מבוססת פעולת הפיצול או המיזוג לא נמצא.",
	contracts_decision_lineage_request_invalid: "בקשת הפיצול או המיזוג אינה תקינה. יש לבדוק את הראיות, השדות והנימוק בעברית.",
	contracts_decision_lineage_stale: "אחת ההחלטות השתנתה בחלון אחר. הרשימה העדכנית נטענה בלי לדרוס את הגרסה החדשה יותר.",
	contracts_decision_lineage_conflict: "לא ניתן לשמור את הפיצול או המיזוג משום שהראיות או היוחסין אינם תואמים עוד למצב השמור.",
	contracts_decision_lineage_rpc_failed: "מאגר KAPAIM דחה את פעולת הפיצול או המיזוג. פרטי הדחייה נרשמו בטרמינל השרת.",
	contracts_decision_lineage_response_invalid: "תוצאת R4.2C שחזרה מ־KAPAIM אינה שלמה או אינה תקינה. לא הוצגה תוצאה חלקית.",
	contracts_indicator_handoff_not_enabled: "ערכת המסירה ל־Indicator עדיין אינה מופעלת בצד השרת.",
	contracts_indicator_handoff_migration_missing: "מקור הקריאה החדש של R6 עדיין אינו זמין ב־KAPAIM.",
	contracts_indicator_handoff_workspace_not_found: "סביבת החוזה המבוקשת לא נמצאה ב־KAPAIM.",
	contracts_indicator_handoff_request_invalid: "בקשת ערכת המסירה ל־Indicator אינה תקינה.",
	contracts_indicator_handoff_source_invalid: "החלטות R4.2 השמורות אינן שלמות מספיק למסירה בטוחה ל־Indicator.",
	contracts_indicator_handoff_safety_violation: "ערכת המסירה נעצרה משום שגבול האפס־כתיבות או ספירת ההחלטות לא נשמר.",
	contracts_workspace_rpc_failed: "מאגר KAPAIM דחה את שמירת חילוץ הסעיפים. פרטי הדחייה נרשמו בטרמינל של השרת.",
	contracts_response_too_large: "חילוץ הסעיפים הושלם, אך התוצאה גדולה ממגבלת התצוגה של השרת.",
	contracts_clause_enrichment_unavailable: "מפתח המודל של סוכן החוזים אינו זמין בצד השרת. יש לבדוק את OPENROUTER_API_KEY ולהפעיל מחדש את השרת.",
	contracts_clause_enrichment_token_budget_exceeded: "החוזה חרג מתקציב הפלט המוגדר להעשרת הסעיפים. לא נשמרה תוצאה חלקית.",
	contracts_clause_enrichment_time_budget_exceeded: "העשרת כל סעיפי החוזה חרגה ממגבלת הזמן. לא נשמרה תוצאה חלקית; אפשר לנסות שוב.",
	contracts_clause_enrichment_provider_failed: "ספק הבינה המלאכותית לא השלים את העשרת סעיפי החוזה. לא נשמרה תוצאה חלקית; אפשר לנסות שוב.",
	contracts_clause_enrichment_ungrounded_numeric_fact: "המודל הוסיף לתקציר מספר שאינו מופיע בסעיף המקור. התוצאה נדחתה ולא נשמר מידע לא מבוסס.",
	contracts_semantic_relationships_not_enabled: "תצוגת קשרי R4.1 אינה מופעלת בשרת. יש לבדוק את האישור המקומי ולהפעיל מחדש את השרת.",
	contracts_semantic_relationships_unavailable: "מפתח המודל של סוכן הקשרים אינו זמין בצד השרת. יש לבדוק את ההגדרה ולהפעיל מחדש את השרת.",
	contracts_semantic_relationships_request_invalid: "בקשת תצוגת הקשרים אינה תקינה. יש לרענן את העמוד ולנסות שוב.",
	contracts_semantic_relationships_token_budget_exceeded: "החוזה חרג מתקציב הניתוח הבטוח של קשרי R4.1. לא נשמרה תוצאה חלקית.",
	contracts_semantic_relationships_time_budget_exceeded: "ניתוח הקשרים חרג ממגבלת הזמן הכוללת. לא נשמרה תוצאה חלקית; אפשר לנסות שוב.",
	contracts_semantic_relationships_provider_failed: "ספק הבינה המלאכותית לא השלים את סיווג זוגות הסעיפים. לא נשמרה תוצאה חלקית; אפשר לנסות שוב.",
	contracts_semantic_relationships_verifier_failed: "הבדיקה הספקנית של הצעות הקשר לא הושלמה. ההצעות שלא אומתו אינן מוצגות; אפשר להריץ שוב.",
	contracts_semantic_relationships_json_invalid: "ספק הבינה המלאכותית החזיר סיווג שאינו תקין גם לאחר ניסיון תיקון. לא נשמרה תוצאה חלקית; אפשר לנסות שוב.",
	contracts_semantic_relationships_schema_invalid: "ספק הבינה המלאכותית החזיר מבנה סיווג שאינו תקין גם לאחר ניסיון תיקון. לא נשמרה תוצאה חלקית; אפשר לנסות שוב.",
	contracts_semantic_relationships_verifier_json_invalid: "הבדיקה הספקנית החזירה תשובה לא תקינה. הזוגות שלא אומתו הושמטו בבטחה מהתצוגה.",
	contracts_semantic_relationships_verifier_schema_invalid: "הבדיקה הספקנית החזירה מבנה לא תקין. הזוגות שלא אומתו הושמטו בבטחה מהתצוגה.",
	contracts_semantic_relationships_response_invalid: "תוצאת סוכן הקשרים חרגה מגבולות הבטיחות של R4.1 ולכן נדחתה ולא נשמרה."
}), sr = Object.freeze({
	candidate_for_schedule_contract_milestones: "מועמד לאבן דרך חוזית",
	candidate_for_schedule_contract_extensions: "מועמד להארכת מועד חוזית",
	candidate_for_schedule_contract_conditions: "מועמד לתנאי חוזי ממתין",
	dry_run_only: "סקירה בלבד — ללא יעד תפעולי"
}), cr = Object.freeze({
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
}), lr = Object.freeze({
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
}), ur = Object.freeze({
	after: "לאחר האירוע המפעיל",
	before: "לפני האירוע המפעיל"
});
function dr(e) {
	return er[e] || "עובדה חוזית הדורשת סקירה";
}
function fr(e) {
	return tr[typeof e == "string" ? e : e?.role] || "בדוק את העובדה החוזית מול הראיה המקורית";
}
function pr(e) {
	return nr[e] || "נדרש בירור נוסף לפני קידום";
}
function mr(e) {
	return rr[e] || pr(e);
}
function hr(e) {
	let t = String(e || "");
	return t.startsWith("review_gate_unresolved:") ? `חסם סקירה טרם נפתר: ${pr(t.slice(23))}` : t.startsWith("unknown_review_candidate:") ? "התקבלה החלטה עבור מועמד שאינו קיים בחילוץ הנוכחי" : t.startsWith("duplicate_review_decision:") ? "נמצאו כמה החלטות עבור אותו מועמד" : ir[t] || "הקידום חסום ונדרשת בדיקה נוספת";
}
function gr(e) {
	return ar[String(e || "")] || "נדרשת בדיקה נוספת לפני מסירה ל־Indicator";
}
function _r(e) {
	return {
		suitable: "מתאימה למסירה ל־Indicator",
		not_suitable: "אינה מתאימה למסירה",
		requires_review: "דורשת סקירה חוזית"
	}[e] || "מצב מסירה לא ידוע";
}
function vr(e) {
	return sr[e] || "אין יעד תפעולי מאושר בשלב זה";
}
function yr(e) {
	return {
		confirm: "אישור",
		reject: "דחייה",
		correct: "תיקון",
		unmapped: "ללא מיפוי"
	}[e] || "החלטת סקירה";
}
function br(e) {
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
function xr(e) {
	return {
		transaction_ready: "מוכן לטרנזקציה",
		blocked: "חסום",
		rejected: "נדחה"
	}[e] || "מצב טרם נקבע";
}
function Sr(e) {
	return cr[e] || "ראיית התאמה ללוח הזמנים";
}
function Cr(e) {
	return lr[e] || "יחידות זמן";
}
function wr(e) {
	return ur[e] || "ביחס לאירוע המפעיל";
}
function Tr(e) {
	return {
		scope_and_execution: "היקף וביצוע",
		commencement_and_completion: "תחילה והשלמה",
		stage_acceptance_and_handover: "קבלת שלב ומסירה",
		payment_and_commercial: "תשלום ומסחר",
		notice_and_communication: "הודעות ותקשורת",
		change_and_approval: "שינוי ואישור",
		bond_and_security: "ערבויות ובטוחות",
		warranty_and_defects: "אחריות וליקויים",
		recurring_compliance: "ציות חוזר",
		delay_extension_and_consequence: "עיכוב, הארכה ותוצאה",
		termination_and_remedy: "סיום ותרופה",
		document_and_information_obligation: "מסמכים ומידע",
		other: "אחר"
	}[e] || "קטגוריה לא ידועה";
}
function Er(e) {
	return {
		proposed: "ממתינה לסקירה",
		approved: "אושרה",
		corrected: "תוקנה ואושרה",
		rejected: "נדחתה",
		unresolved: "סומנה כלא פתורה",
		split: "פוצלה",
		merged: "מוזגה",
		superseded: "הוחלפה בגרסה חדשה"
	}[e] || "מצב סקירה לא ידוע";
}
function Dr(e) {
	return {
		yes: "עשויה להשפיע על לוח הזמנים",
		no: "ללא השפעה על לוח הזמנים",
		unknown: "השפעה על לוח הזמנים טרם הוכרעה"
	}[e] || "השפעה לא ידועה";
}
function Or(e) {
	return {
		none: "ללא כלל זמן",
		fixed: "מועד קבוע",
		relative: "מועד יחסי",
		recurring: "כלל חוזר",
		extension: "הארכת מועד",
		consequence: "תוצאה של איחור"
	}[e] || "סוג זמן לא ידוע";
}
function kr(e) {
	if (!e) return "מועד לא זמין";
	let t = new Date(e);
	return Number.isNaN(t.getTime()) ? "מועד לא זמין" : new Intl.DateTimeFormat("he-IL", {
		dateStyle: "medium",
		timeStyle: "short"
	}).format(t);
}
function K(e) {
	return e?.name === "AbortError" ? "הפעולה חרגה ממגבלת הזמן. אפשר לנסות שוב." : or[e?.code] || "הפעולה נכשלה. אפשר לנסות שוב או לבדוק את הגדרות השרת.";
}
//#endregion
//#region src/react/ContractsPage.jsx
var Ar = "652bf3e0-9a1e-47ca-b06f-cd8dc33907f7", jr = "81b1cbac-8fcf-43c1-acdc-6b5c809de0e5", Mr = [
	"scope_and_execution",
	"commencement_and_completion",
	"stage_acceptance_and_handover",
	"payment_and_commercial",
	"notice_and_communication",
	"change_and_approval",
	"bond_and_security",
	"warranty_and_defects",
	"recurring_compliance",
	"delay_extension_and_consequence",
	"termination_and_remedy",
	"document_and_information_obligation",
	"other"
], Nr = Object.freeze([
	{
		id: "clauses",
		label: "תוכן החוזה",
		description: "סעיפים וחילוץ"
	},
	{
		id: "relationships",
		label: "קשרים בין סעיפים",
		description: "הפניות וקשרים סמנטיים"
	},
	{
		id: "decisions",
		label: "החלטות חוזיות",
		description: "נרמול וסקירה"
	},
	{
		id: "indicator",
		label: "מסירה ל־Indicator",
		description: "ערכת החלטות מאושרת"
	}
]);
function Pr({ activeTab: e, onChange: t }) {
	function n(e, n) {
		let r = null;
		if (e.key === "ArrowLeft" && (r = (n + 1) % Nr.length), e.key === "ArrowRight" && (r = (n - 1 + Nr.length) % Nr.length), e.key === "Home" && (r = 0), e.key === "End" && (r = Nr.length - 1), r === null) return;
		e.preventDefault();
		let i = Nr[r];
		t(i.id), requestAnimationFrame(() => document.getElementById(`contracts-workspace-tab-${i.id}`)?.focus());
	}
	return /* @__PURE__ */ (0, x.jsx)("nav", {
		className: "contractsWorkspaceTabs",
		role: "tablist",
		"aria-label": "שלבי העבודה בחוזה הפתוח",
		children: Nr.map((r, i) => /* @__PURE__ */ (0, x.jsxs)("button", {
			id: `contracts-workspace-tab-${r.id}`,
			type: "button",
			role: "tab",
			"aria-selected": e === r.id,
			"aria-controls": `contracts-workspace-panel-${r.id}`,
			className: e === r.id ? "is-active" : "",
			tabIndex: e === r.id ? 0 : -1,
			onClick: () => t(r.id),
			onKeyDown: (e) => n(e, i),
			children: [/* @__PURE__ */ (0, x.jsx)("strong", { children: r.label }), /* @__PURE__ */ (0, x.jsx)("small", { children: r.description })]
		}, r.id))
	});
}
function Fr({ id: e, activeTab: t, children: n }) {
	let r = t === e;
	return /* @__PURE__ */ (0, x.jsx)("div", {
		id: `contracts-workspace-panel-${e}`,
		className: "contractsWorkspaceTabPanel",
		role: "tabpanel",
		"aria-labelledby": `contracts-workspace-tab-${e}`,
		tabIndex: r ? 0 : -1,
		hidden: !r,
		children: n
	});
}
async function q(e, { method: t = "GET", body: n = null, timeoutMs: r = 12e4 } = {}) {
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
async function Ir(e) {
	let t = new Uint8Array(await e.arrayBuffer()), n = "", r = 32768;
	for (let e = 0; e < t.length; e += r) n += String.fromCharCode(...t.subarray(e, e + r));
	return btoa(n);
}
function Lr(e) {
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
function Rr(e) {
	return e.fixedDate ? `מועד קבוע: ${e.fixedDate}` : e.offset ? `${e.offset.value} ${Cr(e.offset.unit)} ${wr(e.offset.direction)}` : e.metadata?.extensionAmount ? `הארכה: ${e.metadata.extensionAmount} ${Cr(e.metadata.extensionUnit)}` : "ללא ערך זמן סופי";
}
function zr(e) {
	return [e.pdfPage ? `עמוד ${e.pdfPage}` : null, e.clause ? `סעיף ${e.clause}` : null].filter(Boolean).join(" · ") || "מיקום מקור לא צוין";
}
function Br(e) {
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
function Vr(e, t = null) {
	return {
		decisions: Object.fromEntries((e.candidates || []).map((e) => [e.candidateKey, {
			...Lr(e),
			...t?.decisions?.[e.candidateKey] || {}
		}])),
		reviewReason: t?.reviewReason || "",
		batchId: t?.batchId || `contracts-review-${crypto.randomUUID()}`,
		reviewedAt: t?.reviewedAt || (/* @__PURE__ */ new Date()).toISOString(),
		mappingDraft: t?.mappingDraft || null
	};
}
function Hr({ decisions: e, reviewReason: t, batchId: n, reviewedAt: r, mappingDraft: i }) {
	return {
		decisions: e,
		reviewReason: t,
		batchId: n,
		reviewedAt: r,
		mappingDraft: i
	};
}
function Ur(e) {
	return JSON.stringify(e);
}
function Wr(e) {
	let t = Number(e?.revision ?? 0);
	return Number.isSafeInteger(t) && t >= 0 ? t : 0;
}
function Gr(e, t, n) {
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
function Kr({ extraction: e, sourceProjectId: t, status: n, statusError: r, savedState: i = null, savedStateKey: a = "", onDraftStateChange: o = null }) {
	let [s, c] = (0, b.useState)(""), [l, u] = (0, b.useState)(null), [d, f] = (0, b.useState)(null), [p, m] = (0, b.useState)([]), [h, g] = (0, b.useState)(""), [_, v] = (0, b.useState)(""), [y, S] = (0, b.useState)(""), [C, w] = (0, b.useState)(null), T = (0, b.useRef)(null), E = (e.candidates || []).find((e) => e.candidateKey === s) || null, D = p.filter((e) => e.selectedCanonicalKey);
	(0, b.useEffect)(() => {
		let t = (e.candidates || []).find((e) => e.candidateKey === i?.candidateKey) || null, n = t && i?.draft ? {
			...Br(t),
			...i.draft
		} : null;
		c(t?.candidateKey || ""), u(n), f(null), m([]), g(""), S(""), w(null);
	}, [
		e.document?.documentVersionId,
		t,
		a
	]);
	function O(e) {
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
	function k(e) {
		O(e), f(null);
	}
	function A() {
		setTimeout(() => T.current?.scrollIntoView({
			behavior: "smooth",
			block: "center"
		}), 0);
	}
	async function j(n) {
		g("");
		try {
			m((await q(`/api/contracts/activity-mapping/history?${new URLSearchParams({
				sourceProjectId: t,
				documentVersionId: e.document.documentVersionId,
				candidateKey: n.candidateKey,
				limit: "100"
			})}`)).events || []);
		} catch (e) {
			m([]), g(K(e));
		}
	}
	async function M(n) {
		let r = Br(n);
		c(n.candidateKey), u(r), o?.({
			candidateKey: n.candidateKey,
			draft: r
		}), f(null), m([]), S(""), w(null), v("candidates"), j(n);
		try {
			let i = (await q("/api/contracts/activity-mapping/candidates", {
				method: "POST",
				body: {
					sourceProjectId: t,
					obligation: Gr(e, n, r)
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
			}), A();
		} catch (e) {
			S(K(e));
		} finally {
			v("");
		}
	}
	async function N() {
		if (!(!E || !l)) {
			v("candidates"), S(""), w(null);
			try {
				let n = (await q("/api/contracts/activity-mapping/candidates", {
					method: "POST",
					body: {
						sourceProjectId: t,
						obligation: Gr(e, E, l)
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
				}), A();
			} catch (e) {
				S(K(e));
			} finally {
				v("");
			}
		}
	}
	let P = !!d?.blockers?.includes("trigger_evidence_unreviewed");
	function F(e) {
		O({
			action: e,
			selectedActivityKey: ["confirm", "correct"].includes(e) && (l.selectedActivityKey || d?.candidates?.[0]?.activityKey) || "",
			supersedesEventId: e === "correct" ? l.supersedesEventId : ""
		});
	}
	function I() {
		return !d || !l ? "יש לטעון חלופות עדכניות לפני שמירת החלטה." : l.reason.trim().length < 10 ? "נדרש נימוק החלטת מיפוי של לפחות 10 תווים." : ["confirm", "correct"].includes(l.action) && !l.selectedActivityKey ? "יש לבחור פעילות מדויקת." : l.action === "correct" && !l.supersedesEventId ? "יש לבחור אירוע קודם שהתיקון מחליף." : d.conflict && !l.conflictResolved && ["confirm", "correct"].includes(l.action) ? "יש לפתור את הסתירה במפורש." : l.action === "reject" && d.candidates.length === 0 ? "כאשר אין חלופות יש לבחור ללא מיפוי, ולא דחייה." : "";
	}
	async function L() {
		let n = I();
		if (n) return S(n);
		v("review"), S(""), w(null);
		try {
			w(await q("/api/contracts/activity-mapping/review", {
				method: "POST",
				body: {
					sourceProjectId: t,
					obligation: Gr(e, E, l),
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
			}), await j(E);
		} catch (e) {
			S(K(e));
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
					onClick: () => M(e),
					disabled: !!_,
					children: [
						/* @__PURE__ */ (0, x.jsx)("span", { children: dr(e.role) }),
						/* @__PURE__ */ (0, x.jsx)("strong", { children: fr(e) }),
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
								onChange: (e) => k({ mappingRequirement: e.target.value }),
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
								onChange: (e) => k({ conditionStatus: e.target.value }),
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
										onChange: (e) => k({ triggerEvidenceReviewed: e.target.checked })
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
									onChange: (e) => k({ preferMilestone: e.target.checked })
								}), "העדף אבן דרך"]
							})
						]
					}),
					/* @__PURE__ */ (0, x.jsxs)("label", { children: [
						"מונחי מקור להתאמה ללוח, שורה לכל מונח",
						/* @__PURE__ */ (0, x.jsx)("textarea", {
							rows: "3",
							value: l.activityTerms,
							onChange: (e) => k({ activityTerms: e.target.value })
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
						onClick: N,
						children: _ === "candidates" ? "טוען מהמקורות המאושרים…" : "רענן חלופות מהלוח הנוכחי"
					}),
					d && /* @__PURE__ */ (0, x.jsxs)(x.Fragment, { children: [
						/* @__PURE__ */ (0, x.jsx)("div", {
							ref: T,
							className: `contractsMappingOutcome ${P ? "is-blocked" : d.candidates.length ? "is-found" : "is-empty"}`,
							role: "status",
							tabIndex: "-1",
							children: P ? "החיפוש טרם בוצע: יש לסמן שראיות האירוע המפעיל נבדקו, ואז ללחוץ שוב על רענון החלופות." : d.candidates.length ? `החיפוש הושלם ונמצאו ${d.candidates.length} חלופות פעילות לבדיקה.` : "החיפוש הושלם, אך לא נמצאה פעילות מתאימה בלוח הנוכחי. ניתן לתעד החלטה ללא מיפוי."
						}),
						/* @__PURE__ */ (0, x.jsxs)("div", {
							className: "contractsMappingSummary",
							children: [
								/* @__PURE__ */ (0, x.jsxs)("span", { children: ["מצב ", /* @__PURE__ */ (0, x.jsx)("strong", { children: br(d.decisionState) })] }),
								/* @__PURE__ */ (0, x.jsxs)("span", { children: ["גרסת לוח ", /* @__PURE__ */ (0, x.jsx)("strong", {
									dir: "ltr",
									children: d.scheduleVersion.fileId
								})] }),
								/* @__PURE__ */ (0, x.jsxs)("span", { children: ["חלופות ", /* @__PURE__ */ (0, x.jsx)("strong", { children: P ? "טרם בוצע חיפוש" : d.candidates.length })] }),
								/* @__PURE__ */ (0, x.jsxs)("span", { children: ["סתירת גרסה ", /* @__PURE__ */ (0, x.jsx)("strong", { children: d.scheduleVersion.versionConflict ? "כן" : "לא" })] })
							]
						}),
						(d.blockers || []).length > 0 && /* @__PURE__ */ (0, x.jsx)("div", {
							className: "contractsGateList",
							"aria-label": "חסמי מיפוי",
							children: d.blockers.map((e) => /* @__PURE__ */ (0, x.jsx)("span", { children: mr(e) }, e))
						}),
						/* @__PURE__ */ (0, x.jsxs)("div", {
							className: "contractsMappingEvidence",
							children: [/* @__PURE__ */ (0, x.jsx)("strong", { children: "ראיה חוזית מדויקת — הציטוט נשמר בשפת המקור" }), (d.obligation.sourceEvidence || []).map((e) => /* @__PURE__ */ (0, x.jsxs)("blockquote", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: zr(e) }), /* @__PURE__ */ (0, x.jsx)("p", { children: e.sourceText })] }, e.evidenceId))]
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
										onChange: () => O({ selectedActivityKey: e.activityKey })
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
											/* @__PURE__ */ (0, x.jsxs)("strong", { children: [Sr(t.kind), ":"] }),
											" ",
											/* @__PURE__ */ (0, x.jsx)("span", {
												dir: "auto",
												children: t.detail
											})
										] }, `${e.activityKey}-${n}`)),
										(e.blockers || []).map((e) => /* @__PURE__ */ (0, x.jsx)("p", {
											className: "is-blocker",
											children: mr(e)
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
								/* @__PURE__ */ (0, x.jsxs)("strong", { children: ["נמצאה סתירה: ", mr(d.conflict.type)] }),
								/* @__PURE__ */ (0, x.jsx)("p", { children: "אישור אינו אומר שהסעיף תקין; הוא רק בוחר במפורש את הפעילות המתאימה מתוך החלופות הנוכחיות." }),
								/* @__PURE__ */ (0, x.jsxs)("label", {
									className: "contractsCheck",
									children: [/* @__PURE__ */ (0, x.jsx)("input", {
										type: "checkbox",
										checked: l.conflictResolved,
										onChange: (e) => O({ conflictResolved: e.target.checked })
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
									onClick: () => F("confirm"),
									children: "אשר מיפוי"
								}),
								d.candidates.length > 0 && /* @__PURE__ */ (0, x.jsx)("button", {
									type: "button",
									className: l.action === "reject" ? "is-selected danger" : "",
									onClick: () => F("reject"),
									children: "דחה חלופות"
								}),
								/* @__PURE__ */ (0, x.jsx)("button", {
									type: "button",
									className: l.action === "unmapped" ? "is-selected danger" : "",
									onClick: () => F("unmapped"),
									children: "השאר ללא מיפוי"
								}),
								D.length > 0 && /* @__PURE__ */ (0, x.jsx)("button", {
									type: "button",
									className: l.action === "correct" ? "is-selected" : "",
									onClick: () => F("correct"),
									children: "תקן החלטה קודמת"
								})
							]
						}),
						l.action === "correct" && /* @__PURE__ */ (0, x.jsxs)("label", { children: ["אירוע קודם שהתיקון מחליף", /* @__PURE__ */ (0, x.jsxs)("select", {
							value: l.supersedesEventId,
							onChange: (e) => O({ supersedesEventId: e.target.value }),
							children: [/* @__PURE__ */ (0, x.jsx)("option", {
								value: "",
								children: "בחר אירוע בלתי־ניתן לשינוי"
							}), D.map((e) => /* @__PURE__ */ (0, x.jsxs)("option", {
								value: e.eventId,
								children: [
									yr(e.action),
									" · ",
									kr(e.reviewedAt),
									" · ",
									e.selectedActivityKey || e.selectedCanonicalKey
								]
							}, e.eventId))]
						})] }),
						/* @__PURE__ */ (0, x.jsxs)("label", { children: ["נימוק החלטת מיפוי", /* @__PURE__ */ (0, x.jsx)("textarea", {
							rows: "3",
							value: l.reason,
							onChange: (e) => O({ reason: e.target.value })
						})] }),
						/* @__PURE__ */ (0, x.jsx)("button", {
							type: "button",
							className: "contractsCommit",
							disabled: !!_ || !n?.reviewApplyApproved,
							onClick: L,
							children: _ === "review" ? "שומר אירוע ביקורת אטומי…" : `שמור ${yr(l.action)}`
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
									onClick: () => j(E),
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
								/* @__PURE__ */ (0, x.jsxs)("header", { children: [/* @__PURE__ */ (0, x.jsx)("strong", { children: yr(e.action) }), /* @__PURE__ */ (0, x.jsx)("time", {
									dateTime: e.reviewedAt,
									children: kr(e.reviewedAt)
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
function qr({ extraction: e, decisions: t, reviewReason: n, batchId: r, reviewedAt: i, sourceProjectId: a, scheduleProjectId: o }) {
	return {
		extraction: e,
		reviewBatch: {
			batchId: r,
			reviewedAt: i,
			reason: n.trim(),
			documentAuthority: "authoritative",
			extractorVersion: e.extractorVersion || "contracts-agent.phase1.v1",
			decisions: e.candidates.map((e) => {
				let n = t[e.candidateKey] || Lr(e), r = n.action === "approve";
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
function Jr({ candidate: e, decision: t, onChange: n }) {
	let r = t.action === "approve", i = vr(e.storageDisposition), a = e.storageDisposition === "candidate_for_schedule_contract_extensions", o = e.offset?.unit === "day";
	return /* @__PURE__ */ (0, x.jsxs)("article", {
		className: `contractsCandidate ${r ? "is-approved" : "is-rejected"}`,
		children: [
			/* @__PURE__ */ (0, x.jsxs)("header", { children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [
				/* @__PURE__ */ (0, x.jsx)("span", {
					className: "contractsCandidateRole",
					children: dr(e.role)
				}),
				/* @__PURE__ */ (0, x.jsx)("h3", { children: fr(e) }),
				/* @__PURE__ */ (0, x.jsx)("p", { children: Rr(e) })
			] }), /* @__PURE__ */ (0, x.jsx)("span", {
				className: "contractsTarget",
				children: i
			})] }),
			/* @__PURE__ */ (0, x.jsx)("div", {
				className: "contractsEvidenceList",
				children: (e.sourceEvidence || []).map((t, n) => /* @__PURE__ */ (0, x.jsxs)("blockquote", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: zr(t) }), /* @__PURE__ */ (0, x.jsx)("p", { children: t.sourceText })] }, `${e.candidateKey}-evidence-${n}`))
			}),
			(e.gates || []).length > 0 && /* @__PURE__ */ (0, x.jsx)("div", {
				className: "contractsGateList",
				"aria-label": "חסמי קידום",
				children: (e.gates || []).map((e) => /* @__PURE__ */ (0, x.jsx)("span", { children: pr(e) }, e))
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
function Yr({ preview: e, classicDocumentVersionId: t = "" }) {
	let [n, r] = (0, b.useState)(""), [i, a] = (0, b.useState)("operative"), [o, s] = (0, b.useState)("all"), [c, l] = (0, b.useState)("all"), [u, d] = (0, b.useState)(!1), f = (0, b.useMemo)(() => Bn(e), [e]), p = f.clauses || [], m = (0, b.useMemo)(() => [...new Set(p.map((e) => e.clauseType))].sort(), [p]), h = (0, b.useMemo)(() => [...new Set(p.flatMap((e) => e.hashtags || []))].sort(), [p]), g = (0, b.useMemo)(() => new Map(p.map((e) => [e.clauseKey, e])), [p]), _ = n.trim().toLocaleLowerCase("he"), v = (0, b.useMemo)(() => p.filter((e) => i !== "all" && e.structuralRole !== i || o !== "all" && e.clauseType !== o || c !== "all" && !(e.hashtags || []).includes(c) || u && !(e.crossReferences || []).length ? !1 : _ ? [
		e.clauseKey,
		e.parentClauseKey,
		e.clauseTitle,
		e.summaryHe,
		e.rawText,
		e.displayLabelHe,
		e.structuralRoleLabelHe,
		...e.hashtags || [],
		...e.tagLabelsHe || []
	].filter(Boolean).join(" ").toLocaleLowerCase("he").includes(_) : !0), [
		p,
		_,
		u,
		i,
		c,
		o
	]), y = (0, b.useMemo)(() => {
		let e = [], t = /* @__PURE__ */ new Set();
		for (let n of v) {
			let r = g.get(n.parentClauseKey), i = n.structuralRole === "heading" ? n : r?.structuralRole === "heading" ? r : null;
			i && !t.has(i.clauseKey) && (e.push({
				kind: "heading",
				clause: i
			}), t.add(i.clauseKey)), n.structuralRole !== "heading" && e.push({
				kind: "record",
				clause: n
			});
		}
		return e;
	}, [g, v]), S = t ? t === f.document.documentVersionId ? "same-document" : "different-document" : "classic-missing";
	return /* @__PURE__ */ (0, x.jsxs)("section", {
		className: "contractsPanel contractsClausePreviewPanel",
		"aria-labelledby": "contracts-clause-preview-title",
		children: [
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "contractsSectionHeader",
				children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [
					/* @__PURE__ */ (0, x.jsxs)("p", {
						className: "contractsEyebrow",
						children: ["סוכן החוזים · ", f.persisted ? "חילוץ שמור R3.2" : "תצוגת אימות R3.1"]
					}),
					/* @__PURE__ */ (0, x.jsx)("h2", {
						id: "contracts-clause-preview-title",
						children: "2. תוכן החוזה שחולץ"
					}),
					/* @__PURE__ */ (0, x.jsxs)("p", { children: [
						f.document.filename,
						" · ",
						f.document.pageCount,
						" עמודים · ",
						p.length,
						" רשומות מסמך · ",
						f.coverage.operativeCount,
						" הוראות חוזיות"
					] })
				] }), /* @__PURE__ */ (0, x.jsxs)("div", {
					className: "contractsWorkspaceSaveState",
					children: [/* @__PURE__ */ (0, x.jsx)("span", {
						className: "contractsPlanReady",
						children: "כיסוי מקור מלא"
					}), /* @__PURE__ */ (0, x.jsx)("span", {
						className: "contractsDryBadge",
						children: f.persisted ? "נשמר ב־KAPAIM · פתיחה ללא חילוץ חוזר" : "תצוגה מקומית · לא נשמר"
					})]
				})]
			}),
			/* @__PURE__ */ (0, x.jsx)("div", {
				className: `contractsComparisonNotice is-${S}`,
				role: "status",
				children: S === "same-document" ? "תוצאת החילוץ הקלאסי שייכת לאותה גרסת PDF — אפשר להשוות בין שתי התוצאות במסך זה." : S === "different-document" ? "תוצאת החילוץ הקלאסי הפתוחה שייכת לגרסת PDF אחרת. יש להריץ אותה מחדש על הקובץ הנבחר לפני ההשוואה." : "כדי להשוות, אפשר להריץ גם את החילוץ הקלאסי באמצעות הכפתור שבאזור העלאת הקובץ."
			}),
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "contractsClauseMetrics",
				"aria-label": "מדדי שלמות החילוץ",
				children: [
					/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "שורות מקור" }), /* @__PURE__ */ (0, x.jsxs)("strong", { children: [
						f.coverage.accountedSourceLineCount,
						"/",
						f.coverage.sourceLineCount
					] })] }),
					/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "יחידות ממוספרות" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: f.coverage.numberedSourceCount })] }),
					/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "הוראות חוזיות" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: f.coverage.operativeCount })] }),
					/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "כותרות מבניות" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: f.coverage.headingCount })] }),
					/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "הגדרות חוזיות" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: f.coverage.definitionCount })] }),
					/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "רשומות הקשר" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: f.coverage.contextCount })] }),
					/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "הפניות שזוהו" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: f.quality.referenceCount })] }),
					/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "שגיאות כיסוי" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: f.coverage.errorCount })] })
				]
			}),
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "contractsClauseFilters",
				children: [
					/* @__PURE__ */ (0, x.jsxs)("label", { children: ["חיפוש בכל הסעיפים", /* @__PURE__ */ (0, x.jsx)("input", {
						type: "search",
						value: n,
						onChange: (e) => r(e.target.value),
						placeholder: "מספר סעיף, מילה, תקציר או תגית"
					})] }),
					/* @__PURE__ */ (0, x.jsxs)("label", { children: ["תצוגה", /* @__PURE__ */ (0, x.jsxs)("select", {
						value: i,
						onChange: (e) => a(e.target.value),
						children: [
							/* @__PURE__ */ (0, x.jsx)("option", {
								value: "operative",
								children: "הוראות חוזיות בלבד"
							}),
							/* @__PURE__ */ (0, x.jsx)("option", {
								value: "all",
								children: "כל רשומות המסמך"
							}),
							/* @__PURE__ */ (0, x.jsx)("option", {
								value: "heading",
								children: "כותרות ומבנה"
							}),
							/* @__PURE__ */ (0, x.jsx)("option", {
								value: "definition",
								children: "הגדרות חוזיות"
							}),
							/* @__PURE__ */ (0, x.jsx)("option", {
								value: "context",
								children: "הקשר מסמך"
							})
						]
					})] }),
					/* @__PURE__ */ (0, x.jsxs)("label", { children: ["סוג רשומה", /* @__PURE__ */ (0, x.jsxs)("select", {
						value: o,
						onChange: (e) => s(e.target.value),
						children: [/* @__PURE__ */ (0, x.jsx)("option", {
							value: "all",
							children: "כל הסוגים"
						}), m.map((e) => /* @__PURE__ */ (0, x.jsx)("option", {
							value: e,
							children: Pn(e)
						}, e))]
					})] }),
					/* @__PURE__ */ (0, x.jsxs)("label", { children: ["תגית", /* @__PURE__ */ (0, x.jsxs)("select", {
						value: c,
						onChange: (e) => l(e.target.value),
						children: [/* @__PURE__ */ (0, x.jsx)("option", {
							value: "all",
							children: "כל התגיות"
						}), h.map((e) => /* @__PURE__ */ (0, x.jsx)("option", {
							value: e,
							children: In(e)
						}, e))]
					})] }),
					/* @__PURE__ */ (0, x.jsxs)("label", {
						className: "contractsCheck contractsClauseReferenceFilter",
						children: [/* @__PURE__ */ (0, x.jsx)("input", {
							type: "checkbox",
							checked: u,
							onChange: (e) => d(e.target.checked)
						}), "רק סעיפים עם הפניות"]
					})
				]
			}),
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "contractsClauseResultBar",
				children: [
					/* @__PURE__ */ (0, x.jsx)("strong", { children: v.length }),
					" מתוך ",
					p.length,
					" רשומות מוצגות",
					(n || i !== "operative" || o !== "all" || c !== "all" || u) && /* @__PURE__ */ (0, x.jsx)("button", {
						type: "button",
						onClick: () => {
							r(""), a("operative"), s("all"), l("all"), d(!1);
						},
						children: "נקה סינון"
					})
				]
			}),
			/* @__PURE__ */ (0, x.jsx)("div", {
				className: "contractsClauseList",
				children: y.map((e) => e.kind === "heading" ? /* @__PURE__ */ (0, x.jsxs)("section", {
					className: "contractsClauseHeading",
					"aria-label": e.clause.displayLabelHe,
					children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("bdi", {
						dir: "ltr",
						children: e.clause.clauseKey.replace(/\.heading$/u, "")
					}), /* @__PURE__ */ (0, x.jsxs)("span", {
						className: "contractsClauseHeadingText",
						children: [/* @__PURE__ */ (0, x.jsx)("h3", { children: e.clause.clauseTitle || e.clause.displayLabelHe }), e.clause.structuralLeadHe && /* @__PURE__ */ (0, x.jsxs)("p", { children: ["פתיח הסעיף: ", e.clause.structuralLeadHe] })]
					})] }), /* @__PURE__ */ (0, x.jsxs)("span", { children: [e.clause.childCount, " רשומות תחת כותרת זו"] })]
				}, `heading-${e.clause.clauseKey}`) : /* @__PURE__ */ (0, x.jsxs)("details", {
					className: `contractsClauseCard is-${e.clause.structuralRole}`,
					children: [/* @__PURE__ */ (0, x.jsxs)("summary", { children: [
						/* @__PURE__ */ (0, x.jsxs)("span", {
							className: "contractsClauseIdentity",
							children: [/* @__PURE__ */ (0, x.jsx)("bdi", {
								dir: "ltr",
								children: e.clause.clauseKey
							}), /* @__PURE__ */ (0, x.jsxs)("small", { children: [
								e.clause.structuralRoleLabelHe,
								" · ",
								e.clause.pageStart === e.clause.pageEnd ? `עמוד ${e.clause.pageStart}` : `עמודים ${e.clause.pageStart}–${e.clause.pageEnd}`
							] })]
						}),
						/* @__PURE__ */ (0, x.jsx)("span", {
							className: "contractsClauseSummary",
							children: e.clause.summaryHe
						}),
						/* @__PURE__ */ (0, x.jsx)("span", {
							className: "contractsClauseTags",
							children: (e.clause.hashtags || []).map((e) => /* @__PURE__ */ (0, x.jsx)("i", { children: In(e) }, e))
						})
					] }), /* @__PURE__ */ (0, x.jsxs)("div", {
						className: "contractsClauseBody",
						children: [
							/* @__PURE__ */ (0, x.jsxs)("div", {
								className: "contractsClauseSource",
								children: [/* @__PURE__ */ (0, x.jsx)("strong", { children: "הטקסט המקורי" }), /* @__PURE__ */ (0, x.jsx)("p", { children: e.clause.rawText })]
							}),
							/* @__PURE__ */ (0, x.jsxs)("div", {
								className: "contractsClauseEnrichment",
								children: [
									/* @__PURE__ */ (0, x.jsx)("strong", { children: "תוצאת סוכן החוזים" }),
									/* @__PURE__ */ (0, x.jsx)("p", { children: e.clause.summaryHe }),
									/* @__PURE__ */ (0, x.jsxs)("small", { children: ["סיווג: ", Fn(e.clause.structuralRole)] })
								]
							}),
							(e.clause.crossReferences || []).length > 0 && /* @__PURE__ */ (0, x.jsxs)("div", {
								className: "contractsClauseReferences",
								children: [/* @__PURE__ */ (0, x.jsx)("strong", { children: "הפניות מפורשות שנמצאו" }), /* @__PURE__ */ (0, x.jsx)("ul", { children: e.clause.crossReferences.map((e, t) => /* @__PURE__ */ (0, x.jsxs)("li", { children: [
									"“",
									e.referenceText,
									"” ← ",
									e.targetLabelHe,
									/* @__PURE__ */ (0, x.jsx)("span", {
										className: e.resolution === "resolved" ? "is-resolved" : "is-unresolved",
										children: e.resolution === "resolved" ? "נמצא יעד" : "היעד חסר במסמך"
									})
								] }, `${e.referenceText}-${e.targetClauseKey}-${t}`)) })]
							}),
							/* @__PURE__ */ (0, x.jsxs)("details", {
								className: "contractsClauseTechnical contractsClauseRecordTechnical",
								children: [
									/* @__PURE__ */ (0, x.jsx)("summary", { children: "פרטים טכניים של הרשומה" }),
									/* @__PURE__ */ (0, x.jsxs)("div", {
										className: "contractsClauseSearchContent",
										children: [/* @__PURE__ */ (0, x.jsx)("strong", { children: "תוכן החיפוש בעברית" }), /* @__PURE__ */ (0, x.jsx)("p", { children: e.clause.displayContentHe })]
									}),
									/* @__PURE__ */ (0, x.jsxs)("small", { children: ["סטטוס עיבוד: ", e.clause.processingStatus === "processed" ? "עובד ואומת" : e.clause.processingStatus] }),
									e.clause.parentClauseKey && /* @__PURE__ */ (0, x.jsxs)("small", { children: ["מזהה רשומת אב: ", /* @__PURE__ */ (0, x.jsx)("bdi", {
										dir: "ltr",
										children: e.clause.parentClauseKey
									})] }),
									(e.clause.crossReferences || []).map((e, t) => /* @__PURE__ */ (0, x.jsxs)("small", { children: ["מזהה יעד: ", /* @__PURE__ */ (0, x.jsx)("bdi", {
										dir: "ltr",
										children: e.targetClauseKey
									})] }, `technical-reference-${t}`)),
									/* @__PURE__ */ (0, x.jsxs)("footer", { children: [/* @__PURE__ */ (0, x.jsxs)("code", {
										dir: "ltr",
										children: ["מקור ", e.clause.rawTextSha256]
									}), /* @__PURE__ */ (0, x.jsxs)("code", {
										dir: "ltr",
										children: ["תוכן ", e.clause.contentSha256]
									})] })
								]
							})
						]
					})]
				}, e.clause.clauseKey))
			}),
			/* @__PURE__ */ (0, x.jsxs)("details", {
				className: "contractsClauseTechnical",
				children: [
					/* @__PURE__ */ (0, x.jsx)("summary", { children: "פרטי גרסאות טכניים" }),
					/* @__PURE__ */ (0, x.jsx)("code", {
						dir: "ltr",
						children: f.presentationVersion
					}),
					/* @__PURE__ */ (0, x.jsx)("code", {
						dir: "ltr",
						children: f.generations.parserGenerationId
					}),
					/* @__PURE__ */ (0, x.jsx)("code", {
						dir: "ltr",
						children: f.generations.enrichmentGenerationId
					}),
					/* @__PURE__ */ (0, x.jsx)("code", {
						dir: "ltr",
						children: f.generations.modelVersion
					})
				]
			})
		]
	});
}
function Xr(e) {
	let t = Number(e || 0);
	return t >= .97 ? "גבוה מאוד" : t >= .9 ? "גבוה" : "בינוני";
}
var Zr = Object.freeze([
	"supports_same_decision",
	"depends_on",
	"condition_of",
	"exception_to",
	"amends",
	"duplicates",
	"conflicts_with"
]);
function Qr({ item: e, busy: t = !1, onReview: n }) {
	let [r, i] = (0, b.useState)(""), [a, o] = (0, b.useState)(e.relationshipType), [s, c] = (0, b.useState)(!1), l = e.reviewStatus === "proposed", u = r.trim().length >= 10 && /[\u0590-\u05ff]/u.test(r), d = ["duplicates", "conflicts_with"].includes(a), f = a !== e.relationshipType || !d && s, p = s && !d ? e.targetClauseKey : e.sourceClauseKey, m = s && !d ? e.sourceClauseKey : e.targetClauseKey, h = Array.isArray(e.evidence?.excerpts) ? e.evidence.excerpts : [], g = e.evidence?.signals?.autoReview, _ = g?.mode === "model_auto_approval";
	function v(t) {
		let i = { reasonHe: r.trim() };
		t === "correct" && (i.correction = {
			relationshipType: a,
			sourceClauseKey: p,
			targetClauseKey: m
		}), n(e, t, i);
	}
	return /* @__PURE__ */ (0, x.jsxs)("article", {
		className: `contractsRelationshipCard is-semantic is-review-${e.reviewStatus}`,
		children: [
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "contractsRelationshipRoute",
				children: [
					/* @__PURE__ */ (0, x.jsxs)("span", { children: [
						/* @__PURE__ */ (0, x.jsxs)("small", { children: ["סעיף מקור · עמודים ", e.sourcePageStart === e.sourcePageEnd ? e.sourcePageStart : `${e.sourcePageStart}–${e.sourcePageEnd}`] }),
						/* @__PURE__ */ (0, x.jsx)("strong", { children: /* @__PURE__ */ (0, x.jsx)("bdi", {
							dir: "ltr",
							children: e.sourceClauseKey
						}) }),
						/* @__PURE__ */ (0, x.jsx)("p", { children: e.sourceSummaryHe })
					] }),
					/* @__PURE__ */ (0, x.jsx)("b", {
						className: "contractsRelationshipArrow",
						"aria-label": "קשור אל",
						children: "←"
					}),
					/* @__PURE__ */ (0, x.jsxs)("span", { children: [
						/* @__PURE__ */ (0, x.jsxs)("small", { children: ["סעיף יעד · עמודים ", e.targetPageStart === e.targetPageEnd ? e.targetPageStart : `${e.targetPageStart}–${e.targetPageEnd}`] }),
						/* @__PURE__ */ (0, x.jsx)("strong", { children: /* @__PURE__ */ (0, x.jsx)("bdi", {
							dir: "ltr",
							children: e.targetClauseKey
						}) }),
						/* @__PURE__ */ (0, x.jsx)("p", { children: e.targetSummaryHe })
					] })
				]
			}),
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "contractsRelationshipMeta",
				children: [
					/* @__PURE__ */ (0, x.jsx)("i", { children: Xn(e.relationshipType) }),
					/* @__PURE__ */ (0, x.jsx)("i", { children: Zn(e.origin) }),
					/* @__PURE__ */ (0, x.jsx)("i", { children: Qn(e.reviewStatus) }),
					_ && /* @__PURE__ */ (0, x.jsx)("i", {
						title: `מדיניות: ${g.policyVersion}`,
						children: "אושר אוטומטית בידי המודל"
					}),
					e.confidence !== null && e.confidence !== void 0 && /* @__PURE__ */ (0, x.jsxs)("i", {
						title: "ביטחון הסיווג של המודל; אינו ודאות משפטית",
						children: ["ביטחון סיווג: ", Xr(e.confidence)]
					}),
					/* @__PURE__ */ (0, x.jsxs)("span", { children: ["גרסה ", e.revision] })
				]
			}),
			/* @__PURE__ */ (0, x.jsx)("p", {
				className: "contractsRelationshipRationale",
				children: e.evidence?.rationaleHe
			}),
			/* @__PURE__ */ (0, x.jsxs)("details", {
				className: "contractsRelationshipEvidence",
				children: [/* @__PURE__ */ (0, x.jsx)("summary", { children: "הצג את שתי הראיות המקוריות" }), /* @__PURE__ */ (0, x.jsx)("div", { children: h.map((e, t) => /* @__PURE__ */ (0, x.jsx)("blockquote", { children: e.excerpt }, e.clauseId || t)) })]
			}),
			l ? /* @__PURE__ */ (0, x.jsxs)("div", {
				className: "contractsRelationshipReviewForm",
				children: [
					/* @__PURE__ */ (0, x.jsxs)("label", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "נימוק סקירה בעברית — לפחות 10 תווים" }), /* @__PURE__ */ (0, x.jsx)("textarea", {
						rows: "2",
						value: r,
						onChange: (e) => i(e.target.value),
						placeholder: "לדוגמה: שתי הראיות מתארות את אותו קנס יומי בסכומים סותרים.",
						disabled: t
					})] }),
					/* @__PURE__ */ (0, x.jsxs)("div", {
						className: "contractsRelationshipReviewActions",
						children: [/* @__PURE__ */ (0, x.jsx)("button", {
							type: "button",
							className: "contractsPrimary",
							disabled: !u || t,
							onClick: () => v("approve"),
							children: "אשר קשר"
						}), /* @__PURE__ */ (0, x.jsx)("button", {
							type: "button",
							disabled: !u || t,
							onClick: () => v("reject"),
							children: "דחה קשר"
						})]
					}),
					/* @__PURE__ */ (0, x.jsxs)("details", {
						className: "contractsRelationshipCorrection",
						children: [/* @__PURE__ */ (0, x.jsx)("summary", { children: "תקן סוג קשר או כיוון" }), /* @__PURE__ */ (0, x.jsxs)("div", { children: [
							/* @__PURE__ */ (0, x.jsxs)("label", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "סוג הקשר המתוקן" }), /* @__PURE__ */ (0, x.jsx)("select", {
								value: a,
								onChange: (e) => o(e.target.value),
								disabled: t,
								children: Zr.map((e) => /* @__PURE__ */ (0, x.jsx)("option", {
									value: e,
									children: Xn(e)
								}, e))
							})] }),
							/* @__PURE__ */ (0, x.jsxs)("label", {
								className: "contractsRelationshipDirectionToggle",
								children: [/* @__PURE__ */ (0, x.jsx)("input", {
									type: "checkbox",
									checked: s && !d,
									onChange: (e) => c(e.target.checked),
									disabled: t || d
								}), /* @__PURE__ */ (0, x.jsxs)("span", { children: [
									"הפוך כיוון: ",
									/* @__PURE__ */ (0, x.jsx)("bdi", {
										dir: "ltr",
										children: e.targetClauseKey
									}),
									" ← ",
									/* @__PURE__ */ (0, x.jsx)("bdi", {
										dir: "ltr",
										children: e.sourceClauseKey
									})
								] })]
							}),
							d && /* @__PURE__ */ (0, x.jsx)("small", { children: "בקשר סימטרי אין משמעות לכיוון; נקודות הקצה נשמרות בסדר קבוע." }),
							/* @__PURE__ */ (0, x.jsx)("button", {
								type: "button",
								className: "contractsPrimary",
								disabled: !u || !f || t,
								onClick: () => v("correct"),
								children: "שמור תיקון ואשר"
							})
						] })]
					})
				]
			}) : /* @__PURE__ */ (0, x.jsxs)("div", {
				className: "contractsRelationshipReviewedState",
				role: "status",
				children: [
					/* @__PURE__ */ (0, x.jsx)("strong", { children: Qn(e.reviewStatus) }),
					_ && /* @__PURE__ */ (0, x.jsx)("p", { children: "האישור בוצע אוטומטית לאחר הסכמה בין המסווג לבודק העצמאי ועמידה בכללי הבטיחות." }),
					e.reviewReason && /* @__PURE__ */ (0, x.jsx)("p", { children: e.reviewReason }),
					e.reviewedAt && /* @__PURE__ */ (0, x.jsx)("time", {
						dateTime: e.reviewedAt,
						children: kr(e.reviewedAt)
					})
				]
			})
		]
	});
}
function $r({ preview: e, workspaceId: t = "", persistenceStatus: n = null, persistenceResult: r = null, persistenceError: i = "", persistenceBusy: a = !1, onPersist: o, semanticStatus: s = null, semanticResult: c = null, semanticError: l = "", semanticBusy: u = !1, onRunSemantic: d, reviewStatus: f = null, reviewResult: p = null, reviewError: m = "", reviewBusyId: h = "", onReview: g, autoReviewStatus: _ = null, autoReviewResult: v = null, autoReviewError: y = "", autoReviewBusy: S = !1, onAutoReview: C }) {
	let w = (0, b.useMemo)(() => $n(e), [e]), T = Number(r?.metrics?.explicitRelationshipCount || 0), E = Number(p?.metrics?.currentRelationshipCount || 0), D = Number(p?.metrics?.proposedCount || 0), O = !!(n?.ready && t && !a && !u), k = !!(s?.ready && t && !u && !a), A = !!(_?.ready && D > 0 && !S && !u && !a), j = T === w.metrics.explicitRelationshipCount && w.metrics.explicitRelationshipCount > 0, M = Number(c?.metrics?.classificationFailedPairCount || 0), N = Number(c?.metrics?.verificationFailedPairCount || 0), P = c?.metrics?.classificationComplete !== !1 && c?.metrics?.verificationComplete !== !1;
	return /* @__PURE__ */ (0, x.jsxs)("section", {
		className: "contractsPanel contractsRelationshipsPanel",
		"aria-labelledby": "contracts-relationships-title",
		children: [
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "contractsSectionHeader",
				children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [
					/* @__PURE__ */ (0, x.jsx)("p", {
						className: "contractsEyebrow",
						children: "סוכן הקשרים בחוזים · R4.0 + R4.1 + R4.2A"
					}),
					/* @__PURE__ */ (0, x.jsx)("h2", {
						id: "contracts-relationships-title",
						children: "3. קשרים בין סעיפי החוזה"
					}),
					/* @__PURE__ */ (0, x.jsx)("p", { children: "הפניות מפורשות נשמרות בנפרד; קשרים סמנטיים נשמרים כהצעות וממתינים להחלטת סוקר." })
				] }), /* @__PURE__ */ (0, x.jsxs)("div", {
					className: "contractsWorkspaceSaveState",
					role: "status",
					children: [/* @__PURE__ */ (0, x.jsx)("span", {
						className: j ? "contractsPlanReady" : "contractsDryBadge",
						children: j ? `נשמרו ${T} הצעות קשר ב־KAPAIM` : "תצוגה דטרמיניסטית לפני שמירה"
					}), /* @__PURE__ */ (0, x.jsx)("span", {
						className: "contractsDryBadge",
						children: "ללא החלטות חוזיות · ללא כתיבה ללוח הזמנים"
					})]
				})]
			}),
			/* @__PURE__ */ (0, x.jsx)("div", {
				className: "contractsRelationshipBoundary",
				role: "note",
				children: "הפניה מפורשת מוכיחה שסעיף אחד מפנה לסעיף אחר. היא אינה מוכיחה לבדה ששני הסעיפים שייכים לאותה החלטה, תלויים זה בזה או סותרים זה את זה."
			}),
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "contractsClauseMetrics",
				"aria-label": "מדדי סוכן הקשרים",
				children: [
					/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "הפניות מפורשות שנמצאו" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: w.metrics.explicitReferenceCount })] }),
					/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "הצעות קשר ישירות" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: w.metrics.explicitRelationshipCount })] }),
					/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "הפניות ללא יעד" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: w.metrics.unresolvedReferenceCount })] }),
					/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "קשרים שהוצעו בידי מודל" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: w.metrics.modelRelationshipCount })] }),
					/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "החלטות חוזיות שנוצרו" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: w.metrics.decisionCount })] }),
					/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "כתיבות ללוח הזמנים" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: w.metrics.scheduleWriteCount })] })
				]
			}),
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "contractsRelationshipActions",
				children: [/* @__PURE__ */ (0, x.jsx)("button", {
					type: "button",
					className: "contractsPrimary",
					disabled: !O,
					onClick: o,
					children: a ? "שומר הצעות קשר מפורשות…" : j ? "בדוק ושמור שוב ללא כפילויות" : "שמור את הצעות הקשר המפורשות"
				}), /* @__PURE__ */ (0, x.jsx)("p", { children: t ? n?.ready ? "השמירה אטומית וחוזרת משתמשת באותן רשומות במקום ליצור כפילויות." : "מיגרציית R4.0 והפעלת השרת עדיין נדרשות לפני שמירה; התצוגה המקומית כבר זמינה לבדיקה." : "שמירת קשרים זמינה רק לאחר פתיחת חילוץ סעיפים שמור." })]
			}),
			n?.ready && i && /* @__PURE__ */ (0, x.jsx)("div", {
				className: "contractsMessage is-error",
				role: "alert",
				children: i
			}),
			/* @__PURE__ */ (0, x.jsx)("div", {
				className: "contractsRelationshipList",
				children: w.proposals.map((e) => /* @__PURE__ */ (0, x.jsxs)("article", {
					className: "contractsRelationshipCard",
					children: [
						/* @__PURE__ */ (0, x.jsxs)("div", {
							className: "contractsRelationshipRoute",
							children: [
								/* @__PURE__ */ (0, x.jsxs)("span", { children: [
									/* @__PURE__ */ (0, x.jsx)("small", { children: "סעיף מפנה" }),
									/* @__PURE__ */ (0, x.jsxs)("strong", { children: [
										/* @__PURE__ */ (0, x.jsx)("bdi", {
											dir: "ltr",
											children: e.sourceClauseKey
										}),
										" · ",
										e.sourceLabelHe
									] }),
									/* @__PURE__ */ (0, x.jsx)("p", { children: e.sourceSummaryHe })
								] }),
								/* @__PURE__ */ (0, x.jsx)("b", {
									className: "contractsRelationshipArrow",
									"aria-label": "מפנה אל",
									children: "←"
								}),
								/* @__PURE__ */ (0, x.jsxs)("span", { children: [
									/* @__PURE__ */ (0, x.jsx)("small", { children: "סעיף יעד" }),
									/* @__PURE__ */ (0, x.jsxs)("strong", { children: [
										/* @__PURE__ */ (0, x.jsx)("bdi", {
											dir: "ltr",
											children: e.targetClauseKey
										}),
										" · ",
										e.targetLabelHe
									] }),
									/* @__PURE__ */ (0, x.jsx)("p", { children: e.targetSummaryHe })
								] })
							]
						}),
						/* @__PURE__ */ (0, x.jsxs)("div", {
							className: "contractsRelationshipMeta",
							children: [
								/* @__PURE__ */ (0, x.jsx)("i", { children: Xn(e.relationshipType) }),
								/* @__PURE__ */ (0, x.jsx)("i", { children: Zn(e.origin) }),
								/* @__PURE__ */ (0, x.jsx)("i", { children: Qn(e.reviewStatus) }),
								/* @__PURE__ */ (0, x.jsxs)("span", { children: ["הטקסט המפנה: ", e.referenceTexts.map((e) => `“${e}”`).join(" · ")] })
							]
						}),
						/* @__PURE__ */ (0, x.jsx)("p", {
							className: "contractsRelationshipRationale",
							children: e.rationaleHe
						})
					]
				}, e.proposalKey))
			}),
			w.unresolvedReferences.length > 0 && /* @__PURE__ */ (0, x.jsxs)("details", {
				className: "contractsRelationshipUnresolved",
				children: [/* @__PURE__ */ (0, x.jsxs)("summary", { children: [w.unresolvedReferences.length, " הפניות נשמרו לבדיקה משום שלא נמצא להן יעד"] }), /* @__PURE__ */ (0, x.jsx)("ul", { children: w.unresolvedReferences.map((e, t) => /* @__PURE__ */ (0, x.jsxs)("li", { children: [
					/* @__PURE__ */ (0, x.jsx)("bdi", {
						dir: "ltr",
						children: e.sourceClauseKey
					}),
					" · “",
					e.referenceText,
					"” → ",
					e.targetLabelHe,
					". ",
					e.reasonHe
				] }, `${e.sourceClauseKey}-${e.targetClauseKey}-${t}`)) })]
			}),
			/* @__PURE__ */ (0, x.jsxs)("section", {
				className: "contractsSemanticRelationships",
				"aria-labelledby": "contracts-semantic-relationships-title",
				children: [
					/* @__PURE__ */ (0, x.jsxs)("div", {
						className: "contractsSectionHeader",
						children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [
							/* @__PURE__ */ (0, x.jsx)("p", {
								className: "contractsEyebrow",
								children: "R4.1 · גילוי קשרים סמנטיים"
							}),
							/* @__PURE__ */ (0, x.jsx)("h3", {
								id: "contracts-semantic-relationships-title",
								children: "הצעות קשר שאינן כתובות כהפניה ישירה"
							}),
							/* @__PURE__ */ (0, x.jsx)("p", { children: "הסוכן מדרג זוגות מתוך אותה גרסת חוזה ומציע קשר רק כאשר שתי הראיות תומכות בסוג הקשר ובכיוונו." })
						] }), /* @__PURE__ */ (0, x.jsxs)("div", {
							className: "contractsWorkspaceSaveState",
							role: "status",
							children: [/* @__PURE__ */ (0, x.jsx)("span", {
								className: f?.ready ? "contractsPlanReady" : "contractsDryBadge",
								children: f?.ready ? E > 0 ? `${E} קשרים שמורים · ${D} ממתינים לסקירה` : "תוצאות מלאות יישמרו ב־KAPAIM לסקירה" : "תצוגת איכות זמנית · אינה נשמרת"
							}), /* @__PURE__ */ (0, x.jsx)("span", {
								className: "contractsDryBadge",
								children: "ללא יצירת החלטות · ללא הכרעה בסתירות"
							})]
						})]
					}),
					/* @__PURE__ */ (0, x.jsx)("div", {
						className: "contractsRelationshipBoundary is-semantic",
						role: "note",
						children: "דמיון בנושא בלבד אינו מספיק. כל הצעה עוברת כלל מקור קשיח ובדיקה ספקנית נפרדת של המודל. ביטחון הסיווג אינו ודאות משפטית. רק הצעות בביטחון גבוה שעוברות גם בדיקות פערים עשויות לקבל אישור אוטומטי; כל היתר נשארות לסקירה אנושית."
					}),
					/* @__PURE__ */ (0, x.jsxs)("div", {
						className: "contractsRelationshipActions",
						children: [/* @__PURE__ */ (0, x.jsx)("button", {
							type: "button",
							className: "contractsPrimary",
							disabled: !k,
							onClick: d,
							children: u ? "מאתר, בודק ושומר קשרים סמנטיים…" : f?.ready ? c ? "הרץ שוב ושמור ללא כפילויות" : "הרץ, אמת ושמור הצעות לסקירה" : c ? "הרץ שוב תצוגת קשרים סמנטיים" : "הרץ תצוגת קשרים סמנטיים"
						}), /* @__PURE__ */ (0, x.jsx)("p", { children: t ? s?.applyApproved ? s?.modelConfigured ? f?.ready ? "רק ניתוח מלא שעבר את הבדיקה הספקנית יישמר; הרצה חוזרת משתמשת ברשומות קיימות ואינה מוחקת החלטות סקירה." : "הניתוח משתמש רק בסעיפים השמורים ובמפתח המודל שבשרת; הדפדפן אינו שולח סעיפים או הגדרות מודל." : "מפתח המודל אינו מוגדר בשרת." : "הפעלת R4.1 המקומית עדיין לא אושרה בשרת." : "הניתוח זמין לאחר פתיחת חילוץ סעיפים שמור." })]
					}),
					l && /* @__PURE__ */ (0, x.jsx)("div", {
						className: "contractsMessage is-error",
						role: "alert",
						children: l
					}),
					m && /* @__PURE__ */ (0, x.jsx)("div", {
						className: "contractsMessage is-error",
						role: "alert",
						children: m
					}),
					c && /* @__PURE__ */ (0, x.jsxs)(x.Fragment, { children: [
						!P && /* @__PURE__ */ (0, x.jsxs)("div", {
							className: "contractsMessage is-warning",
							role: "status",
							children: [
								"הניתוח הושלם חלקית ובאופן בטוח. ",
								[M > 0 ? `${M} זוגות לא סווגו משום שתשובת המסווג לא הייתה תקינה.` : "", N > 0 ? `${N} זוגות לא הוצגו משום שהבדיקה הספקנית שלהם לא הושלמה.` : ""].filter(Boolean).join(" "),
								" אפשר להריץ שוב כדי לנסות להשלים אותם."
							]
						}),
						/* @__PURE__ */ (0, x.jsxs)("div", {
							className: "contractsClauseMetrics",
							"aria-label": "מדדי גילוי קשרים סמנטיים",
							children: [
								/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "זוגות מועמדים שנבחרו" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: c.metrics?.candidatePairCount || 0 })] }),
								/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "זוגות שנבדקו בידי המודל" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: c.metrics?.modelAssessedPairCount || 0 })] }),
								/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "זוגות שלא סווגו עקב תשובה לא תקינה" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: M })] }),
								/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "קשרים שהציע המסווג" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: c.metrics?.classifierRelationshipCount || 0 })] }),
								/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "הצעות שנשלחו לבדיקה ספקנית" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: c.metrics?.relationshipVerificationAssessedCount || 0 })] }),
								/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "הצעות שנדחו בכלל מקור קשיח" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: c.metrics?.deterministicTypeGateRejectedCount || 0 })] }),
								/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "הצעות שנדחו בבדיקה הספקנית" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: c.metrics?.relationshipVerificationRejectedCount || 0 })] }),
								/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "זוגות שלא הוצגו עקב כשל בבדיקה" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: N })] }),
								/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "הצעות סופיות לסקירה" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: c.metrics?.modelRelationshipCount || 0 })] }),
								/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "זוגות שסווגו ללא קשר" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: c.metrics?.noRelationshipCount || 0 })] }),
								/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "הצעות מתחת לסף הביטחון" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: c.metrics?.belowThresholdCount || 0 })] }),
								/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "מתוכן: סתירות בין צדדים שונים שנדחו" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: c.metrics?.asymmetricConflictRejectedCount || 0 })] }),
								/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "החלטות חוזיות שנוצרו" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: c.metrics?.decisionCount || 0 })] }),
								/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "קשרים שמורים לסקירה" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: E })] }),
								/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "כתיבות ללוח הזמנים" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: c.metrics?.scheduleWriteCount || 0 })] })
							]
						}),
						/* @__PURE__ */ (0, x.jsx)("div", {
							className: "contractsRelationshipList",
							children: (c.proposals || []).map((e) => /* @__PURE__ */ (0, x.jsxs)("article", {
								className: "contractsRelationshipCard is-semantic",
								children: [
									/* @__PURE__ */ (0, x.jsxs)("div", {
										className: "contractsRelationshipRoute",
										children: [
											/* @__PURE__ */ (0, x.jsxs)("span", { children: [
												/* @__PURE__ */ (0, x.jsxs)("small", { children: ["סעיף מקור · עמודים ", e.sourcePageStart === e.sourcePageEnd ? e.sourcePageStart : `${e.sourcePageStart}–${e.sourcePageEnd}`] }),
												/* @__PURE__ */ (0, x.jsx)("strong", { children: /* @__PURE__ */ (0, x.jsx)("bdi", {
													dir: "ltr",
													children: e.sourceClauseKey
												}) }),
												/* @__PURE__ */ (0, x.jsx)("p", { children: e.sourceSummaryHe })
											] }),
											/* @__PURE__ */ (0, x.jsx)("b", {
												className: "contractsRelationshipArrow",
												"aria-label": "קשור אל",
												children: "←"
											}),
											/* @__PURE__ */ (0, x.jsxs)("span", { children: [
												/* @__PURE__ */ (0, x.jsxs)("small", { children: ["סעיף יעד · עמודים ", e.targetPageStart === e.targetPageEnd ? e.targetPageStart : `${e.targetPageStart}–${e.targetPageEnd}`] }),
												/* @__PURE__ */ (0, x.jsx)("strong", { children: /* @__PURE__ */ (0, x.jsx)("bdi", {
													dir: "ltr",
													children: e.targetClauseKey
												}) }),
												/* @__PURE__ */ (0, x.jsx)("p", { children: e.targetSummaryHe })
											] })
										]
									}),
									/* @__PURE__ */ (0, x.jsxs)("div", {
										className: "contractsRelationshipMeta",
										children: [
											/* @__PURE__ */ (0, x.jsx)("i", { children: Xn(e.relationshipType) }),
											/* @__PURE__ */ (0, x.jsx)("i", { children: Zn(e.origin) }),
											/* @__PURE__ */ (0, x.jsx)("i", { children: Qn(e.reviewStatus) }),
											/* @__PURE__ */ (0, x.jsxs)("i", {
												title: "ביטחון סיווג של המודל לאחר בדיקה ספקנית; אינו ודאות משפטית",
												children: ["ביטחון סיווג: ", Xr(e.confidence)]
											})
										]
									}),
									/* @__PURE__ */ (0, x.jsx)("p", {
										className: "contractsRelationshipRationale",
										children: e.rationaleHe
									}),
									/* @__PURE__ */ (0, x.jsxs)("details", {
										className: "contractsRelationshipEvidence",
										children: [/* @__PURE__ */ (0, x.jsx)("summary", { children: "הצג את שתי הראיות המקוריות" }), /* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("blockquote", { children: e.sourceExcerpt }), /* @__PURE__ */ (0, x.jsx)("blockquote", { children: e.targetExcerpt })] })]
									})
								]
							}, e.proposalKey))
						}),
						(c.proposals || []).length === 0 && P && /* @__PURE__ */ (0, x.jsx)("div", {
							className: "contractsMessage",
							role: "status",
							children: "לא נמצאה הצעת קשר שעברה את סף הביטחון. לא נוצרה תוצאה מלאכותית."
						}),
						(c.proposals || []).length === 0 && !P && /* @__PURE__ */ (0, x.jsx)("div", {
							className: "contractsMessage",
							role: "status",
							children: "לא מוצגות הצעות שלא עברו סיווג ובדיקה ספקנית מלאים. אפשר להריץ שוב כדי להשלים את הניתוח."
						})
					] }),
					p && /* @__PURE__ */ (0, x.jsxs)("section", {
						className: "contractsRelationshipReviewQueue",
						"aria-labelledby": "contracts-relationship-review-title",
						children: [
							/* @__PURE__ */ (0, x.jsxs)("div", {
								className: "contractsSectionHeader",
								children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [
									/* @__PURE__ */ (0, x.jsx)("p", {
										className: "contractsEyebrow",
										children: "R4.2A + R4.2A.1 · סקירה שמורה ואישור אוטומטי בטוח"
									}),
									/* @__PURE__ */ (0, x.jsx)("h4", {
										id: "contracts-relationship-review-title",
										children: "הצעות קשר שנשמרו ב־KAPAIM"
									}),
									/* @__PURE__ */ (0, x.jsx)("p", { children: "כל פעולה יוצרת גרסה חדשה ביומן; שום הצעה קיימת אינה נדרסת או נמחקת." })
								] }), /* @__PURE__ */ (0, x.jsxs)("span", {
									className: "contractsPlanReady",
									children: [D, " ממתינים להחלטה"]
								})]
							}),
							/* @__PURE__ */ (0, x.jsxs)("div", {
								className: "contractsClauseMetrics",
								"aria-label": "מדדי סקירת קשרים שמורים",
								children: [
									/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "קשרים נוכחיים" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: p.metrics?.currentRelationshipCount || 0 })] }),
									/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "ממתינים לסקירה" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: D })] }),
									/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "אושרו" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: p.metrics?.approvedCount || 0 })] }),
									/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "תוקנו ואושרו" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: p.metrics?.correctedCount || 0 })] }),
									/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "נדחו" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: p.metrics?.rejectedCount || 0 })] }),
									/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "הוחלפו בתיקון" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: p.metrics?.supersededCount || 0 })] }),
									/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "החלטות חוזיות שנוצרו" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: p.metrics?.decisionCount || 0 })] }),
									/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "כתיבות ללוח הזמנים" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: p.metrics?.scheduleWriteCount || 0 })] })
								]
							}),
							/* @__PURE__ */ (0, x.jsxs)("div", {
								className: "contractsRelationshipActions",
								children: [/* @__PURE__ */ (0, x.jsx)("button", {
									type: "button",
									className: "contractsPrimary",
									disabled: !A,
									onClick: C,
									children: S ? "בודק ומאשר קשרים בטוחים…" : "אשר אוטומטית קשרים בטוחים"
								}), /* @__PURE__ */ (0, x.jsx)("p", { children: _?.ready ? D === 0 ? "אין קשרים שממתינים לבדיקה אוטומטית." : "הפעולה מאשרת בלבד: סתירות, כפילויות, פערי סכומים או מועדים ומקרים לא ודאיים נשארים לסקירה אנושית." : "מיגרציית R4.2A.1 נדרשת. אין צורך במשתנה סביבה חדש." })]
							}),
							y && /* @__PURE__ */ (0, x.jsx)("div", {
								className: "contractsMessage is-error",
								role: "alert",
								children: y
							}),
							v && /* @__PURE__ */ (0, x.jsxs)("div", {
								className: "contractsMessage is-success",
								role: "status",
								children: [
									"אושרו אוטומטית ",
									v.autoReview?.approvedCount || 0,
									" קשרים; ",
									v.autoReview?.humanReviewRequiredCount || 0,
									" נשארו לסקירה אנושית. לא נוצרו החלטות ולא בוצעו כתיבות ללוח הזמנים."
								]
							}),
							/* @__PURE__ */ (0, x.jsx)("div", {
								className: "contractsRelationshipList",
								children: (p.items || []).map((e) => /* @__PURE__ */ (0, x.jsx)(Qr, {
									item: e,
									busy: h === e.relationshipId,
									onReview: g
								}, e.relationshipId))
							}),
							(p.items || []).length === 0 && /* @__PURE__ */ (0, x.jsx)("div", {
								className: "contractsMessage",
								role: "status",
								children: "עדיין לא נשמרו הצעות קשר סמנטיות עבור חילוץ זה."
							})
						]
					})
				]
			})
		]
	});
}
function ei(e, { sourceClauseIds: t = null, primaryClauseId: n = null, titleHe: r = null, summaryHe: i = null, decisionTextHe: a = null, decisionCategory: o = null, scheduleImpact: s = null, responsibleParty: c = void 0, beneficiary: l = void 0 } = {}) {
	let u = (t || e.sourceEvidence?.map((e) => e.clauseId) || []).filter(Boolean), d = [...new Set((Array.isArray(e.tags) ? e.tags : []).map((e) => String(e || "").trim()).filter(Boolean).map((e) => /[\u0590-\u05ff]/u.test(e) ? e : In(e)))].slice(0, 12);
	return {
		primaryClauseId: n || u[0],
		sourceClauseIds: u,
		titleHe: (r ?? e.titleHe ?? "").trim(),
		summaryHe: (i ?? e.summaryHe ?? "").trim(),
		decisionTextHe: (a ?? e.decisionTextHe ?? "").trim(),
		tags: d,
		responsibleParty: c === void 0 ? e.responsibleParty || null : c || null,
		beneficiary: l === void 0 ? e.beneficiary || null : l || null,
		decisionCategory: o || e.decisionCategory || "other",
		conflictStatus: e.conflictStatus || "none",
		scheduleImpact: s || e.scheduleImpact || "unknown",
		temporalKind: e.temporalKind || "none",
		contractDate: e.contractDate || null,
		triggerKind: e.triggerKind || null,
		triggerDescriptionHe: e.triggerDescriptionHe || null,
		offsetValue: e.offsetValue ?? null,
		offsetUnit: e.offsetUnit || null,
		calendarSemantics: e.calendarSemantics || "unknown",
		recurring: !!e.recurring
	};
}
function ti(e, t) {
	let n = (e.sourceEvidence || []).map((e) => e.clauseId).filter(Boolean);
	return {
		id: `${e.decisionId}:split:${t}:${Date.now()}`,
		titleHe: `חלק ${t + 1}: ${e.titleHe || "החלטה חוזית"}`,
		summaryHe: e.summaryHe || "",
		decisionTextHe: e.decisionTextHe || "",
		decisionCategory: e.decisionCategory || "other",
		scheduleImpact: e.scheduleImpact || "unknown",
		sourceClauseIds: n,
		primaryClauseId: n[0] || ""
	};
}
function ni({ item: e, busy: t = !1, onCancel: n, onSplit: r }) {
	let [i, a] = (0, b.useState)(""), [o, s] = (0, b.useState)(() => [ti(e, 0), ti(e, 1)]), c = Array.isArray(e.sourceEvidence) ? e.sourceEvidence : [], l = c.map((e) => e.clauseId).filter(Boolean);
	function u(e, t) {
		s((n) => n.map((n, r) => r === e ? {
			...n,
			...t
		} : n));
	}
	function d(e, t) {
		let n = o[e], r = n.sourceClauseIds.includes(t) ? n.sourceClauseIds.filter((e) => e !== t) : [...n.sourceClauseIds, t];
		u(e, {
			sourceClauseIds: r,
			primaryClauseId: r.includes(n.primaryClauseId) ? n.primaryClauseId : r[0] || ""
		});
	}
	let f = i.trim().length >= 10 && /[א-ת]/u.test(i), p = o.length >= 2 && o.every((e) => e.sourceClauseIds.length > 0 && e.sourceClauseIds.includes(e.primaryClauseId) && e.titleHe.trim().length >= 5 && /[א-ת]/u.test(e.titleHe) && e.summaryHe.trim().length >= 10 && /[א-ת]/u.test(e.summaryHe) && e.decisionTextHe.trim().length >= 10 && /[א-ת]/u.test(e.decisionTextHe)) && l.every((e) => o.some((t) => t.sourceClauseIds.includes(e)));
	function m() {
		r(e, {
			expectedRevision: e.revision,
			reasonHe: i.trim(),
			outputs: o.map((t) => ei(e, t))
		});
	}
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		className: "contractsDecisionLineageEditor is-split",
		children: [
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "contractsSectionHeader",
				children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("strong", { children: "פיצול החלטה עם יוחסין מלאים" }), /* @__PURE__ */ (0, x.jsx)("p", { children: "כל חלק נשמר כהחלטה חדשה. אפשר להשתמש באותה ראיית מקור בכמה חלקים, אך יחד הם חייבים לכסות את כל הראיות המקוריות." })] }), /* @__PURE__ */ (0, x.jsx)("button", {
					type: "button",
					onClick: n,
					disabled: t,
					children: "בטל פיצול"
				})]
			}),
			/* @__PURE__ */ (0, x.jsx)("div", {
				className: "contractsDecisionSplitParts",
				children: o.map((e, n) => /* @__PURE__ */ (0, x.jsxs)("fieldset", {
					className: "contractsDecisionSplitPart",
					children: [
						/* @__PURE__ */ (0, x.jsxs)("legend", { children: ["החלטה חדשה ", n + 1] }),
						/* @__PURE__ */ (0, x.jsxs)("label", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "כותרת" }), /* @__PURE__ */ (0, x.jsx)("input", {
							value: e.titleHe,
							onChange: (e) => u(n, { titleHe: e.target.value }),
							disabled: t
						})] }),
						/* @__PURE__ */ (0, x.jsxs)("label", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "תקציר" }), /* @__PURE__ */ (0, x.jsx)("textarea", {
							rows: "3",
							value: e.summaryHe,
							onChange: (e) => u(n, { summaryHe: e.target.value }),
							disabled: t
						})] }),
						/* @__PURE__ */ (0, x.jsxs)("label", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "משמעות חוזית מנורמלת" }), /* @__PURE__ */ (0, x.jsx)("textarea", {
							rows: "4",
							value: e.decisionTextHe,
							onChange: (e) => u(n, { decisionTextHe: e.target.value }),
							disabled: t
						})] }),
						/* @__PURE__ */ (0, x.jsxs)("div", {
							className: "contractsDecisionLineageFields",
							children: [/* @__PURE__ */ (0, x.jsxs)("label", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "קטגוריה" }), /* @__PURE__ */ (0, x.jsx)("select", {
								value: e.decisionCategory,
								onChange: (e) => u(n, { decisionCategory: e.target.value }),
								disabled: t,
								children: Mr.map((e) => /* @__PURE__ */ (0, x.jsx)("option", {
									value: e,
									children: Tr(e)
								}, e))
							})] }), /* @__PURE__ */ (0, x.jsxs)("label", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "השפעה אפשרית על לוח הזמנים" }), /* @__PURE__ */ (0, x.jsxs)("select", {
								value: e.scheduleImpact,
								onChange: (e) => u(n, { scheduleImpact: e.target.value }),
								disabled: t,
								children: [
									/* @__PURE__ */ (0, x.jsx)("option", {
										value: "yes",
										children: "כן"
									}),
									/* @__PURE__ */ (0, x.jsx)("option", {
										value: "no",
										children: "לא"
									}),
									/* @__PURE__ */ (0, x.jsx)("option", {
										value: "unknown",
										children: "טרם הוכרע"
									})
								]
							})] })]
						}),
						/* @__PURE__ */ (0, x.jsxs)("div", {
							className: "contractsDecisionEvidencePicker",
							children: [/* @__PURE__ */ (0, x.jsx)("strong", { children: "ראיות מקור להחלטה זו" }), c.map((r, i) => /* @__PURE__ */ (0, x.jsxs)("label", { children: [/* @__PURE__ */ (0, x.jsx)("input", {
								type: "checkbox",
								checked: e.sourceClauseIds.includes(r.clauseId),
								onChange: () => d(n, r.clauseId),
								disabled: t
							}), /* @__PURE__ */ (0, x.jsxs)("span", { children: [
								"עמודים ",
								r.pageStart === r.pageEnd ? r.pageStart : `${r.pageStart}–${r.pageEnd}`,
								" · ",
								String(r.excerpt || "").slice(0, 180)
							] })] }, r.clauseId || i))]
						}),
						o.length > 2 && /* @__PURE__ */ (0, x.jsx)("button", {
							type: "button",
							onClick: () => s((e) => e.filter((e, t) => t !== n)),
							disabled: t,
							children: "הסר חלק"
						})
					]
				}, e.id))
			}),
			o.length < 10 && /* @__PURE__ */ (0, x.jsx)("button", {
				type: "button",
				onClick: () => s((t) => [...t, ti(e, t.length)]),
				disabled: t,
				children: "הוסף החלטה לפיצול"
			}),
			/* @__PURE__ */ (0, x.jsxs)("label", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "נימוק הפיצול בעברית — לפחות 10 תווים" }), /* @__PURE__ */ (0, x.jsx)("textarea", {
				rows: "3",
				value: i,
				onChange: (e) => a(e.target.value),
				disabled: t
			})] }),
			!p && /* @__PURE__ */ (0, x.jsx)("p", {
				className: "contractsLineageValidation",
				children: "יש להשלים לפחות שתי החלטות ולוודא שכל ראיות המקור נכללות לפחות באחת מהן."
			}),
			/* @__PURE__ */ (0, x.jsx)("button", {
				type: "button",
				className: "contractsPrimary",
				disabled: !f || !p || t,
				onClick: m,
				children: "שמור פיצול אטומי"
			})
		]
	});
}
function ri({ items: e, busy: t = !1, onCancel: n, onMerge: r }) {
	let [i, a] = (0, b.useState)(e[0]?.decisionId || ""), o = e.find((e) => e.decisionId === i) || e[0], [s, c] = (0, b.useState)(""), [l, u] = (0, b.useState)(o?.titleHe || ""), [d, f] = (0, b.useState)(o?.summaryHe || ""), [p, m] = (0, b.useState)(o?.decisionTextHe || ""), [h, g] = (0, b.useState)(o?.decisionCategory || "other"), [_, v] = (0, b.useState)(o?.scheduleImpact || "unknown"), y = /* @__PURE__ */ new Map();
	for (let t of e) for (let e of t.sourceEvidence || []) y.set(e.clauseId, e);
	let S = [...y.values()], C = [...new Set(e.flatMap((e) => Array.isArray(e.tags) ? e.tags : []))].slice(0, 12), w = e.some((e) => e.conflictStatus === "unresolved"), T = e.length >= 2 && s.trim().length >= 10 && /[א-ת]/u.test(s) && l.trim().length >= 5 && /[א-ת]/u.test(l) && d.trim().length >= 10 && /[א-ת]/u.test(d) && p.trim().length >= 10 && /[א-ת]/u.test(p) && S.length > 0;
	function E(t) {
		let n = e.find((e) => e.decisionId === t);
		a(t), u(n?.titleHe || ""), f(n?.summaryHe || ""), m(n?.decisionTextHe || ""), g(n?.decisionCategory || "other"), v(n?.scheduleImpact || "unknown");
	}
	function D() {
		let t = ei({
			...o,
			tags: C,
			conflictStatus: w ? "unresolved" : o.conflictStatus
		}, {
			sourceClauseIds: S.map((e) => e.clauseId),
			primaryClauseId: S.some((e) => e.clauseId === o.primaryClauseId) ? o.primaryClauseId : S[0]?.clauseId,
			titleHe: l,
			summaryHe: d,
			decisionTextHe: p,
			decisionCategory: h,
			scheduleImpact: _
		});
		r({
			sources: e.map((e) => ({
				decisionId: e.decisionId,
				expectedRevision: e.revision
			})),
			reasonHe: s.trim(),
			output: t
		});
	}
	return /* @__PURE__ */ (0, x.jsxs)("div", {
		className: "contractsDecisionLineageEditor is-merge",
		children: [
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "contractsSectionHeader",
				children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsxs)("strong", { children: [
					"מיזוג ",
					e.length,
					" החלטות"
				] }), /* @__PURE__ */ (0, x.jsx)("p", { children: "ההחלטות המקוריות יסומנו כממוזגות, תיווצר החלטה חדשה וכל קישורי היוחסין והראיות יישמרו אטומית." })] }), /* @__PURE__ */ (0, x.jsx)("button", {
					type: "button",
					onClick: n,
					disabled: t,
					children: "בטל בחירה"
				})]
			}),
			/* @__PURE__ */ (0, x.jsxs)("label", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "החלטת בסיס לשדות הזמנים והגורמים" }), /* @__PURE__ */ (0, x.jsx)("select", {
				value: i,
				onChange: (e) => E(e.target.value),
				disabled: t,
				children: e.map((e) => /* @__PURE__ */ (0, x.jsx)("option", {
					value: e.decisionId,
					children: e.titleHe
				}, e.decisionId))
			})] }),
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "contractsDecisionLineageFields",
				children: [
					/* @__PURE__ */ (0, x.jsxs)("label", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "כותרת ההחלטה הממוזגת" }), /* @__PURE__ */ (0, x.jsx)("input", {
						value: l,
						onChange: (e) => u(e.target.value),
						disabled: t
					})] }),
					/* @__PURE__ */ (0, x.jsxs)("label", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "קטגוריה" }), /* @__PURE__ */ (0, x.jsx)("select", {
						value: h,
						onChange: (e) => g(e.target.value),
						disabled: t,
						children: Mr.map((e) => /* @__PURE__ */ (0, x.jsx)("option", {
							value: e,
							children: Tr(e)
						}, e))
					})] }),
					/* @__PURE__ */ (0, x.jsxs)("label", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "השפעה אפשרית על לוח הזמנים" }), /* @__PURE__ */ (0, x.jsxs)("select", {
						value: _,
						onChange: (e) => v(e.target.value),
						disabled: t,
						children: [
							/* @__PURE__ */ (0, x.jsx)("option", {
								value: "yes",
								children: "כן"
							}),
							/* @__PURE__ */ (0, x.jsx)("option", {
								value: "no",
								children: "לא"
							}),
							/* @__PURE__ */ (0, x.jsx)("option", {
								value: "unknown",
								children: "טרם הוכרע"
							})
						]
					})] })
				]
			}),
			/* @__PURE__ */ (0, x.jsxs)("label", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "תקציר מאוחד" }), /* @__PURE__ */ (0, x.jsx)("textarea", {
				rows: "3",
				value: d,
				onChange: (e) => f(e.target.value),
				disabled: t
			})] }),
			/* @__PURE__ */ (0, x.jsxs)("label", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "משמעות חוזית מאוחדת" }), /* @__PURE__ */ (0, x.jsx)("textarea", {
				rows: "5",
				value: p,
				onChange: (e) => m(e.target.value),
				disabled: t
			})] }),
			/* @__PURE__ */ (0, x.jsx)("div", {
				className: "contractsDecisionMergeSources",
				children: e.map((e) => /* @__PURE__ */ (0, x.jsxs)("span", { children: [
					e.titleHe,
					" · גרסה ",
					e.revision
				] }, e.decisionId))
			}),
			/* @__PURE__ */ (0, x.jsxs)("p", { children: [
				"המיזוג ישמור ",
				S.length,
				" ראיות מקור מאוחדות. ",
				w ? "הסתירה תישאר לא פתורה; לא תיבחר הוראה גוברת." : "לא מתבצעת הכרעה משפטית אוטומטית."
			] }),
			/* @__PURE__ */ (0, x.jsxs)("label", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "נימוק המיזוג בעברית — לפחות 10 תווים" }), /* @__PURE__ */ (0, x.jsx)("textarea", {
				rows: "3",
				value: s,
				onChange: (e) => c(e.target.value),
				disabled: t
			})] }),
			/* @__PURE__ */ (0, x.jsx)("button", {
				type: "button",
				className: "contractsPrimary",
				disabled: !T || t,
				onClick: D,
				children: "שמור מיזוג אטומי"
			})
		]
	});
}
function ii({ item: e, busy: t = !1, lineageEnabled: n = !1, selectedForMerge: r = !1, onToggleMerge: i, onSplit: a, onReview: o }) {
	let [s, c] = (0, b.useState)(""), [l, u] = (0, b.useState)(!1), [d, f] = (0, b.useState)(!1), [p, m] = (0, b.useState)(() => ({
		titleHe: e.titleHe || "",
		summaryHe: e.summaryHe || "",
		decisionTextHe: e.decisionTextHe || "",
		responsibleParty: e.responsibleParty || "",
		beneficiary: e.beneficiary || "",
		decisionCategory: e.decisionCategory || "other",
		scheduleImpact: e.scheduleImpact || "unknown"
	})), h = e.reviewStatus === "proposed", g = n && [
		"proposed",
		"approved",
		"corrected",
		"unresolved"
	].includes(e.reviewStatus) && e.projectionStatus !== "projected", _ = s.trim().length >= 10 && /[א-ת]/u.test(s), v = /[א-ת]/u.test(p.titleHe) && p.titleHe.trim().length >= 5 && /[א-ת]/u.test(p.summaryHe) && p.summaryHe.trim().length >= 10 && /[א-ת]/u.test(p.decisionTextHe) && p.decisionTextHe.trim().length >= 10, y = Array.isArray(e.sourceEvidence) ? e.sourceEvidence : [];
	function S(t) {
		o(e, t, {
			reasonHe: s.trim(),
			...t === "correct" ? { correction: {
				titleHe: p.titleHe.trim(),
				summaryHe: p.summaryHe.trim(),
				decisionTextHe: p.decisionTextHe.trim(),
				responsibleParty: p.responsibleParty.trim() || null,
				beneficiary: p.beneficiary.trim() || null,
				decisionCategory: p.decisionCategory,
				conflictStatus: e.conflictStatus || "none",
				scheduleImpact: p.scheduleImpact,
				temporalKind: e.temporalKind || "none",
				contractDate: e.contractDate || null,
				triggerKind: e.triggerKind || null,
				triggerDescriptionHe: e.triggerDescriptionHe || null,
				offsetValue: e.offsetValue ?? null,
				offsetUnit: e.offsetUnit || null,
				calendarSemantics: e.calendarSemantics || "unknown",
				recurring: !!e.recurring
			} } : {}
		});
	}
	return /* @__PURE__ */ (0, x.jsxs)("article", {
		className: `contractsDecisionCard is-${e.reviewStatus}`,
		children: [
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "contractsDecisionCardHeader",
				children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsxs)("small", { children: [
					Tr(e.decisionCategory),
					" · גרסה ",
					e.revision
				] }), /* @__PURE__ */ (0, x.jsx)("h4", { children: e.titleHe })] }), /* @__PURE__ */ (0, x.jsx)("span", {
					className: "contractsPlanReady",
					children: Er(e.reviewStatus)
				})]
			}),
			/* @__PURE__ */ (0, x.jsx)("p", {
				className: "contractsDecisionSummary",
				children: e.summaryHe
			}),
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "contractsDecisionMeaning",
				children: [/* @__PURE__ */ (0, x.jsx)("strong", { children: "המשמעות החוזית המנורמלת" }), /* @__PURE__ */ (0, x.jsx)("p", { children: e.decisionTextHe })]
			}),
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "contractsRelationshipMeta",
				children: [
					/* @__PURE__ */ (0, x.jsx)("i", { children: Dr(e.scheduleImpact) }),
					/* @__PURE__ */ (0, x.jsx)("i", { children: Or(e.temporalKind) }),
					e.responsibleParty && /* @__PURE__ */ (0, x.jsxs)("i", { children: ["אחראי: ", e.responsibleParty] }),
					e.beneficiary && /* @__PURE__ */ (0, x.jsxs)("i", { children: ["זכאי: ", e.beneficiary] }),
					e.conflictStatus === "unresolved" && /* @__PURE__ */ (0, x.jsx)("i", { children: "סתירה לא פתורה · לא נבחרה חלופה" })
				]
			}),
			(e.contractDate || e.triggerDescriptionHe || e.offsetValue !== null && e.offsetValue !== void 0) && /* @__PURE__ */ (0, x.jsxs)("div", {
				className: "contractsDecisionTemporal",
				children: [
					e.contractDate && /* @__PURE__ */ (0, x.jsxs)("span", { children: ["מועד חוזי מפורש: ", /* @__PURE__ */ (0, x.jsx)("bdi", {
						dir: "ltr",
						children: e.contractDate
					})] }),
					e.triggerDescriptionHe && /* @__PURE__ */ (0, x.jsxs)("span", { children: ["אירוע מפעיל: ", e.triggerDescriptionHe] }),
					e.offsetValue !== null && e.offsetValue !== void 0 && /* @__PURE__ */ (0, x.jsxs)("span", { children: [
						"מרווח מקור: ",
						e.offsetValue,
						" ",
						Cr(e.offsetUnit)
					] })
				]
			}),
			/* @__PURE__ */ (0, x.jsxs)("details", {
				className: "contractsRelationshipEvidence",
				children: [/* @__PURE__ */ (0, x.jsxs)("summary", { children: [
					"הצג ",
					y.length,
					" ראיות מקור מדויקות"
				] }), /* @__PURE__ */ (0, x.jsx)("div", { children: y.map((e, t) => /* @__PURE__ */ (0, x.jsxs)("blockquote", { children: [/* @__PURE__ */ (0, x.jsxs)("small", { children: ["עמודים ", e.pageStart === e.pageEnd ? e.pageStart : `${e.pageStart}–${e.pageEnd}`] }), e.excerpt] }, e.clauseId || t)) })]
			}),
			g && /* @__PURE__ */ (0, x.jsxs)("div", {
				className: "contractsDecisionLineageActions",
				role: "group",
				"aria-label": "פעולות פיצול ומיזוג",
				children: [/* @__PURE__ */ (0, x.jsx)("button", {
					type: "button",
					disabled: t,
					onClick: () => f((e) => !e),
					children: d ? "סגור פיצול" : "פצל החלטה"
				}), /* @__PURE__ */ (0, x.jsxs)("label", { children: [/* @__PURE__ */ (0, x.jsx)("input", {
					type: "checkbox",
					checked: r,
					onChange: () => i(e),
					disabled: t
				}), "בחר למיזוג"] })]
			}),
			d && g && /* @__PURE__ */ (0, x.jsx)(ni, {
				item: e,
				busy: t,
				onCancel: () => f(!1),
				onSplit: a
			}),
			h ? /* @__PURE__ */ (0, x.jsxs)("div", {
				className: "contractsDecisionReviewForm",
				children: [
					/* @__PURE__ */ (0, x.jsxs)("label", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "נימוק סקירה בעברית — לפחות 10 תווים" }), /* @__PURE__ */ (0, x.jsx)("textarea", {
						rows: "2",
						value: s,
						onChange: (e) => c(e.target.value),
						placeholder: "לדוגמה: ההחלטה משקפת במדויק את הסעיפים המצוטטים ואת הגורם האחראי.",
						disabled: t
					})] }),
					/* @__PURE__ */ (0, x.jsxs)("div", {
						className: "contractsRelationshipReviewActions",
						children: [
							/* @__PURE__ */ (0, x.jsx)("button", {
								type: "button",
								className: "contractsPrimary",
								disabled: !_ || t,
								onClick: () => S("approve"),
								children: "אשר החלטה"
							}),
							/* @__PURE__ */ (0, x.jsx)("button", {
								type: "button",
								disabled: !_ || t,
								onClick: () => S("reject"),
								children: "דחה החלטה"
							}),
							/* @__PURE__ */ (0, x.jsx)("button", {
								type: "button",
								disabled: !_ || t,
								onClick: () => S("unresolved"),
								children: "סמן כלא פתורה"
							}),
							/* @__PURE__ */ (0, x.jsx)("button", {
								type: "button",
								disabled: t,
								onClick: () => u((e) => !e),
								children: "תקן לפני אישור"
							})
						]
					}),
					l && /* @__PURE__ */ (0, x.jsxs)("div", {
						className: "contractsDecisionCorrection",
						children: [
							/* @__PURE__ */ (0, x.jsxs)("label", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "כותרת ההחלטה" }), /* @__PURE__ */ (0, x.jsx)("input", {
								value: p.titleHe,
								onChange: (e) => m((t) => ({
									...t,
									titleHe: e.target.value
								})),
								disabled: t
							})] }),
							/* @__PURE__ */ (0, x.jsxs)("label", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "תקציר" }), /* @__PURE__ */ (0, x.jsx)("textarea", {
								rows: "3",
								value: p.summaryHe,
								onChange: (e) => m((t) => ({
									...t,
									summaryHe: e.target.value
								})),
								disabled: t
							})] }),
							/* @__PURE__ */ (0, x.jsxs)("label", {
								className: "contractsDecisionCorrectionWide",
								children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "משמעות חוזית מנורמלת" }), /* @__PURE__ */ (0, x.jsx)("textarea", {
									rows: "5",
									value: p.decisionTextHe,
									onChange: (e) => m((t) => ({
										...t,
										decisionTextHe: e.target.value
									})),
									disabled: t
								})]
							}),
							/* @__PURE__ */ (0, x.jsxs)("label", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "קטגוריה" }), /* @__PURE__ */ (0, x.jsx)("select", {
								value: p.decisionCategory,
								onChange: (e) => m((t) => ({
									...t,
									decisionCategory: e.target.value
								})),
								disabled: t,
								children: Mr.map((e) => /* @__PURE__ */ (0, x.jsx)("option", {
									value: e,
									children: Tr(e)
								}, e))
							})] }),
							/* @__PURE__ */ (0, x.jsxs)("label", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "השפעה חוזית אפשרית על לוח הזמנים" }), /* @__PURE__ */ (0, x.jsxs)("select", {
								value: p.scheduleImpact,
								onChange: (e) => m((t) => ({
									...t,
									scheduleImpact: e.target.value
								})),
								disabled: t,
								children: [
									/* @__PURE__ */ (0, x.jsx)("option", {
										value: "yes",
										children: "כן"
									}),
									/* @__PURE__ */ (0, x.jsx)("option", {
										value: "no",
										children: "לא"
									}),
									/* @__PURE__ */ (0, x.jsx)("option", {
										value: "unknown",
										children: "טרם הוכרע"
									})
								]
							})] }),
							/* @__PURE__ */ (0, x.jsxs)("label", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "גורם אחראי" }), /* @__PURE__ */ (0, x.jsx)("input", {
								value: p.responsibleParty,
								onChange: (e) => m((t) => ({
									...t,
									responsibleParty: e.target.value
								})),
								disabled: t
							})] }),
							/* @__PURE__ */ (0, x.jsxs)("label", { children: [/* @__PURE__ */ (0, x.jsx)("span", { children: "גורם זכאי" }), /* @__PURE__ */ (0, x.jsx)("input", {
								value: p.beneficiary,
								onChange: (e) => m((t) => ({
									...t,
									beneficiary: e.target.value
								})),
								disabled: t
							})] }),
							/* @__PURE__ */ (0, x.jsx)("button", {
								type: "button",
								className: "contractsPrimary",
								disabled: !_ || !v || t,
								onClick: () => S("correct"),
								children: "שמור תיקון ואשר"
							})
						]
					})
				]
			}) : /* @__PURE__ */ (0, x.jsxs)("div", {
				className: "contractsRelationshipReviewedState",
				role: "status",
				children: [
					/* @__PURE__ */ (0, x.jsx)("strong", { children: Er(e.reviewStatus) }),
					e.reviewReason && /* @__PURE__ */ (0, x.jsx)("p", { children: e.reviewReason }),
					e.reviewedAt && /* @__PURE__ */ (0, x.jsx)("time", {
						dateTime: e.reviewedAt,
						children: kr(e.reviewedAt)
					})
				]
			})
		]
	});
}
function ai({ status: e, lineageStatus: t, result: n, autoReviewStatus: r, autoReviewResult: i, autoReviewError: a = "", autoReviewBusy: o = !1, relationshipPendingCount: s = 0, error: c = "", generationBusy: l = !1, reviewBusyId: u = "", onGenerate: d, onAutoReview: f, onSplit: p, onMerge: m, onReview: h }) {
	let [g, _] = (0, b.useState)([]), v = Number(n?.metrics?.pendingRelationshipCount ?? s ?? 0), y = Number(n?.metrics?.currentDecisionCount || 0), S = Number(n?.lineage?.metrics?.activeDecisionCount ?? y), C = Number(n?.metrics?.proposedCount || 0), w = !!(t?.ready && n?.lineage?.gates?.splitEnabled && n?.lineage?.gates?.mergeEnabled), T = new Map((n?.items || []).map((e) => [e.decisionId, e])), E = g.map((e) => T.get(e)).filter(Boolean), D = !!(e?.ready && n?.workspace?.workspaceId && v === 0 && y === 0 && !l), O = !!(r?.ready && C > 0 && !l && !o && !u), k = i?.plan?.metrics;
	function A(e) {
		_((t) => t.includes(e.decisionId) ? t.filter((t) => t !== e.decisionId) : t.length < 10 ? [...t, e.decisionId] : t);
	}
	function j(e) {
		m(e);
	}
	return /* @__PURE__ */ (0, x.jsxs)("section", {
		className: "contractsPanel contractsDecisionsPanel",
		"aria-labelledby": "contracts-decisions-title",
		children: [
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "contractsSectionHeader",
				children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [
					/* @__PURE__ */ (0, x.jsx)("p", {
						className: "contractsEyebrow",
						children: "סוכן ההחלטות בחוזים · R4.2B + R4.2C"
					}),
					/* @__PURE__ */ (0, x.jsx)("h2", {
						id: "contracts-decisions-title",
						children: "4. החלטות חוזיות מנורמלות"
					}),
					/* @__PURE__ */ (0, x.jsx)("p", { children: "הסוכן מאחד סעיפים קשורים להצעה אחת; הסוקר יכול לאשר, לתקן, לפצל או למזג, וכל פעולה נשמרת עם ראיות ויוחסין בלתי־ניתנים לדריסה." })
				] }), /* @__PURE__ */ (0, x.jsxs)("div", {
					className: "contractsWorkspaceSaveState",
					role: "status",
					children: [/* @__PURE__ */ (0, x.jsx)("span", {
						className: y > 0 ? "contractsPlanReady" : "contractsDryBadge",
						children: y > 0 ? `${y} החלטות שמורות ב־KAPAIM` : "טרם נוצרו הצעות החלטה"
					}), /* @__PURE__ */ (0, x.jsx)("span", {
						className: "contractsDryBadge",
						children: "ללא הכרעת סתירות · ללא כתיבה ללוח הזמנים"
					})]
				})]
			}),
			/* @__PURE__ */ (0, x.jsx)("div", {
				className: "contractsRelationshipBoundary is-semantic",
				role: "note",
				children: "R4.2B משתמש רק בסעיפים ובקשרים השמורים. R4.2C אינו קורא שוב למודל: פיצול ומיזוג הם פעולות סוקר אטומיות בלבד. אף אחד מהשלבים אינו בוחר הוראה גוברת, מחשב מועד ביצוע או כותב ללוח הזמנים."
			}),
			/* @__PURE__ */ (0, x.jsx)("div", {
				className: w ? "contractsMessage is-success" : "contractsMessage is-warning",
				role: "status",
				children: w ? "R4.2C פעיל: אפשר לפצל החלטה או לבחור 2–10 החלטות למיזוג. כל קישור יוחסין נשמר ב־KAPAIM." : "פעולות הפיצול והמיזוג יופיעו לאחר הפעלת מיגרציית R4.2C בצד השרת."
			}),
			v > 0 ? /* @__PURE__ */ (0, x.jsxs)("div", {
				className: "contractsMessage is-warning",
				role: "status",
				children: [
					"לפני יצירת החלטות יש לעבור על ",
					v,
					" הצעות הקשר שנותרו למעלה. לאחר ההחלטה האחרונה הכפתור ייפתח אוטומטית."
				]
			}) : /* @__PURE__ */ (0, x.jsx)("div", {
				className: "contractsMessage is-success",
				role: "status",
				children: "סקירת הקשרים הושלמה. אפשר ליצור ולשמור את הצעות ההחלטה המנורמלות."
			}),
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "contractsRelationshipActions",
				children: [/* @__PURE__ */ (0, x.jsx)("button", {
					type: "button",
					className: "contractsPrimary",
					disabled: !D,
					onClick: d,
					children: l ? "מנרמל ושומר את כל הצעות ההחלטה…" : y > 0 ? "הצעות ההחלטה כבר שמורות" : "צור ושמור הצעות החלטה"
				}), /* @__PURE__ */ (0, x.jsx)("p", { children: e?.applyApproved ? e?.modelConfigured ? v > 0 ? "היצירה נעולה עד שכל קשר נשמר כאישור, תיקון או דחייה." : y > 0 ? "הרצה חוזרת אינה קוראת שוב למודל ואינה מחליפה החלטות שכבר נשמרו." : "היצירה אטומית: אם הצעה אחת אינה תקינה, לא תישמר תוצאה חלקית." : "מפתח המודל אינו מוגדר בצד השרת." : "הפעלת R4.2B המקומית או המיגרציה עדיין אינן זמינות." })]
			}),
			y > 0 && /* @__PURE__ */ (0, x.jsxs)("div", {
				className: "contractsRelationshipActions contractsDecisionAutoReviewActions",
				children: [/* @__PURE__ */ (0, x.jsx)("button", {
					type: "button",
					className: "contractsPrimary",
					disabled: !O,
					onClick: f,
					children: o ? "בודק כל החלטה בבדיקה עצמאית…" : C > 0 ? "בדוק ואשר אוטומטית החלטות בטוחות" : "אין החלטות שממתינות לסקירה"
				}), /* @__PURE__ */ (0, x.jsx)("p", { children: "בודק עצמאי מאמת כל החלטה מול ראיות המקור. רק הסכמה בביטחון של 98% ומעלה עוברת אישור; כל ספק, פער מספרי או סיווג זמן חסר נשאר לסקירה אנושית. אין דחייה, תיקון או מסירה אוטומטית ל־Indicator." })]
			}),
			!r?.applyApproved && y > 0 && /* @__PURE__ */ (0, x.jsx)("div", {
				className: "contractsMessage is-warning",
				role: "status",
				children: "מסלול R4.2B.1 לאישור אוטומטי בטוח עדיין אינו זמין בתהליך השרת או ב־KAPAIM."
			}),
			a && /* @__PURE__ */ (0, x.jsx)("div", {
				className: "contractsMessage is-error",
				role: "alert",
				children: a
			}),
			k && /* @__PURE__ */ (0, x.jsxs)("div", {
				className: "contractsClauseMetrics",
				"aria-label": "מדדי אישור אוטומטי של החלטות",
				children: [
					/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "נבדקו" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: k.inputPendingCount || 0 })] }),
					/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "אושרו אוטומטית" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: i.autoReview?.approvedCount || 0 })] }),
					/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "נשארו לסקירה אנושית" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: i.autoReview?.humanReviewRequiredCount || 0 })] }),
					/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "קריאות לבודק" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: k.modelCallCount || 0 })] }),
					/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "קבוצות בדיקה שנכשלו בבטחה" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: k.failedBatchCount || 0 })] }),
					/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "כתיבות ללוח הזמנים" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: k.scheduleWriteCount || 0 })] })
				]
			}),
			c && /* @__PURE__ */ (0, x.jsx)("div", {
				className: "contractsMessage is-error",
				role: "alert",
				children: c
			}),
			n && y > 0 && /* @__PURE__ */ (0, x.jsxs)(x.Fragment, { children: [
				/* @__PURE__ */ (0, x.jsxs)("div", {
					className: "contractsClauseMetrics",
					"aria-label": "מדדי החלטות חוזיות שמורות",
					children: [
						/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "החלטות פעילות" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: S })] }),
						/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "ממתינות לסקירה" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: C })] }),
						/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "אושרו" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: n.metrics?.approvedCount || 0 })] }),
						/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "תוקנו ואושרו" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: n.metrics?.correctedCount || 0 })] }),
						/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "נדחו" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: n.metrics?.rejectedCount || 0 })] }),
						/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "סומנו כלא פתורות" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: n.metrics?.unresolvedCount || 0 })] }),
						/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "מקורות שפוצלו" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: n.lineage?.metrics?.splitParentCount || 0 })] }),
						/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "מקורות שמוזגו" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: n.lineage?.metrics?.mergedSourceCount || 0 })] }),
						/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "קישורי יוחסין שמורים" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: n.lineage?.metrics?.lineageLinkCount || 0 })] }),
						/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "כתיבות ללוח הזמנים" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: n.metrics?.scheduleWriteCount || 0 })] })
					]
				}),
				w && E.length > 0 && E.length < 2 && /* @__PURE__ */ (0, x.jsx)("div", {
					className: "contractsMessage is-warning",
					role: "status",
					children: "נבחרה החלטה אחת למיזוג. יש לבחור לפחות החלטה נוספת."
				}),
				w && E.length >= 2 && /* @__PURE__ */ (0, x.jsx)(ri, {
					items: E,
					busy: u === "lineage:merge",
					onCancel: () => _([]),
					onMerge: j
				}, E.map((e) => e.decisionId).join(":")),
				/* @__PURE__ */ (0, x.jsx)("div", {
					className: "contractsDecisionList",
					children: (n.items || []).map((e) => /* @__PURE__ */ (0, x.jsx)(ii, {
						item: e,
						busy: u === e.decisionId || u === `lineage:${e.decisionId}` || u === "lineage:merge",
						lineageEnabled: w,
						selectedForMerge: g.includes(e.decisionId),
						onToggleMerge: A,
						onSplit: p,
						onReview: h
					}, e.decisionId))
				}),
				(n.lineage?.links || []).length > 0 && /* @__PURE__ */ (0, x.jsxs)("section", {
					className: "contractsDecisionLineageHistory",
					"aria-labelledby": "contracts-lineage-history-title",
					children: [/* @__PURE__ */ (0, x.jsx)("div", {
						className: "contractsSectionHeader",
						children: /* @__PURE__ */ (0, x.jsxs)("div", { children: [
							/* @__PURE__ */ (0, x.jsx)("p", {
								className: "contractsEyebrow",
								children: "R4.2C · יומן יוחסין שמור"
							}),
							/* @__PURE__ */ (0, x.jsx)("h3", {
								id: "contracts-lineage-history-title",
								children: "פיצולים ומיזוגים"
							}),
							/* @__PURE__ */ (0, x.jsx)("p", { children: "כל חץ הוא רשומת קשר עצמאית בגרף החוזי, עם סוקר, זמן ונימוק." })
						] })
					}), /* @__PURE__ */ (0, x.jsx)("div", {
						className: "contractsDecisionLineageLinks",
						children: (n.lineage.links || []).map((e) => {
							let t = T.get(e.sourceDecisionId), n = T.get(e.targetDecisionId);
							return /* @__PURE__ */ (0, x.jsxs)("article", { children: [
								/* @__PURE__ */ (0, x.jsx)("strong", { children: Xn(e.relationshipType) }),
								/* @__PURE__ */ (0, x.jsxs)("p", { children: [
									t?.titleHe || e.sourceDecisionId,
									" ← ",
									n?.titleHe || e.targetDecisionId
								] }),
								/* @__PURE__ */ (0, x.jsxs)("small", { children: [
									e.reviewReason,
									" · ",
									kr(e.reviewedAt)
								] })
							] }, e.relationshipId);
						})
					})]
				})
			] })
		]
	});
}
function oi({ item: e }) {
	return /* @__PURE__ */ (0, x.jsxs)("article", {
		className: `contractsScheduleProjectionCard is-${e.handoffStatus}`,
		children: [
			/* @__PURE__ */ (0, x.jsxs)("header", { children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: _r(e.handoffStatus) }), /* @__PURE__ */ (0, x.jsx)("h3", { children: e.titleHe })] }), /* @__PURE__ */ (0, x.jsx)("span", { children: e.reviewStatus || Er(e.reviewStatusCode) })] }),
			/* @__PURE__ */ (0, x.jsx)("p", { children: e.summaryHe }),
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "contractsRelationshipMeta",
				children: [
					/* @__PURE__ */ (0, x.jsx)("i", { children: e.categoryHe || Tr("other") }),
					/* @__PURE__ */ (0, x.jsx)("i", { children: e.indicatorSuitability || "נדרשת בדיקה" }),
					/* @__PURE__ */ (0, x.jsx)("i", { children: Or(e.timing?.kind || "none") })
				]
			}),
			/* @__PURE__ */ (0, x.jsx)("ul", {
				className: "contractsScheduleProjectionBlockers",
				children: (e.reasonCodes || []).map((e) => /* @__PURE__ */ (0, x.jsx)("li", { children: gr(e) }, e))
			}),
			e.sourceEvidence?.length > 0 && /* @__PURE__ */ (0, x.jsxs)("details", {
				className: "contractsRelationshipEvidence",
				children: [/* @__PURE__ */ (0, x.jsx)("summary", { children: "הצג ראיות מקור מדויקות" }), /* @__PURE__ */ (0, x.jsx)("div", {
					className: "contractsScheduleAuditEvidence",
					children: e.sourceEvidence.map((t, n) => /* @__PURE__ */ (0, x.jsxs)("blockquote", { children: [/* @__PURE__ */ (0, x.jsxs)("small", { children: [
						"סעיף ",
						t.clauseKey || "ללא מספר",
						" · עמודים ",
						t.pageStart || "?",
						t.pageEnd && t.pageEnd !== t.pageStart ? `–${t.pageEnd}` : ""
					] }), /* @__PURE__ */ (0, x.jsx)("p", { children: t.excerpt })] }, `${t.clauseId || e.decisionId}:${n}`))
				})]
			})
		]
	});
}
function si({ status: e, result: t, error: n = "", busy: r = !1, disabled: i = !1, onRun: a }) {
	let o = t?.metrics || {}, s = (t?.items || []).filter((e) => e.handoffStatus === "suitable"), c = (t?.items || []).filter((e) => e.handoffStatus === "requires_review"), l = (t?.items || []).filter((e) => e.handoffStatus === "not_suitable"), u = !!(e?.ready && e?.mode === "indicator_handoff_read_only");
	return /* @__PURE__ */ (0, x.jsxs)("section", {
		className: "contractsPanel contractsScheduleProjectionPanel",
		"aria-labelledby": "contracts-indicator-handoff-title",
		children: [
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "contractsSectionHeader",
				children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [
					/* @__PURE__ */ (0, x.jsx)("p", {
						className: "contractsEyebrow",
						children: "מסירת החלטות לסוכן Indicator · R5"
					}),
					/* @__PURE__ */ (0, x.jsx)("h2", {
						id: "contracts-indicator-handoff-title",
						children: "5. ערכת החלטות ל־Indicator"
					}),
					/* @__PURE__ */ (0, x.jsx)("p", { children: "סוכן החוזים קובע רק אילו החלטות חוזיות מתאימות להמשך טיפול. סוכן Indicator יקבע בהמשך פרויקט, יעד, פעילות, חישובי תאריך וכל כתיבה ללוח הזמנים." })
				] }), /* @__PURE__ */ (0, x.jsxs)("div", {
					className: "contractsWorkspaceSaveState",
					role: "status",
					children: [/* @__PURE__ */ (0, x.jsx)("span", {
						className: "contractsPlanReady",
						children: "ערכת מסירה לקריאה בלבד"
					}), /* @__PURE__ */ (0, x.jsx)("span", {
						className: "contractsDryBadge",
						children: "אפס כתיבות · ללא שיבוץ בלוח הזמנים"
					})]
				})]
			}),
			/* @__PURE__ */ (0, x.jsx)("div", {
				className: "contractsRelationshipBoundary is-semantic",
				role: "note",
				children: "הסיווג נגזר מן ההחלטה השמורה שכבר עברה סקירה: מתאימה ל־Indicator, אינה מתאימה, או דורשת השלמת סקירה. אין טבלת אמת נוספת ואין שכפול של ההחלטה החוזית."
			}),
			/* @__PURE__ */ (0, x.jsxs)("div", {
				className: "contractsRelationshipActions",
				children: [/* @__PURE__ */ (0, x.jsx)("button", {
					type: "button",
					className: "contractsPrimary",
					disabled: !u || i,
					onClick: a,
					children: r ? "טוען ערכת מסירה…" : "טען את ערכת המסירה ל־Indicator"
				}), /* @__PURE__ */ (0, x.jsx)("p", { children: "הערכה משתמשת רק באמת החוזית השמורה. היא אינה קוראת פעילויות, אינה דורשת מיפוי פרויקט ואינה מפעילה את מנוע Schedule." })]
			}),
			!u && /* @__PURE__ */ (0, x.jsx)("div", {
				className: "contractsMessage is-warning",
				role: "status",
				children: "ערכת המסירה של R5 טרם הופעלה בתהליך השרת הנוכחי. יש להפעיל מחדש את השרת לאחר עדכון הקוד."
			}),
			n && /* @__PURE__ */ (0, x.jsx)("div", {
				className: "contractsMessage is-error",
				role: "alert",
				children: n
			}),
			t && /* @__PURE__ */ (0, x.jsxs)(x.Fragment, { children: [
				/* @__PURE__ */ (0, x.jsxs)("div", {
					className: "contractsClauseMetrics contractsScheduleProjectionMetrics",
					children: [
						/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "כל ההחלטות הנוכחיות" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: o.currentDecisionCount || 0 })] }),
						/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "מתאימות ל־Indicator" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: o.suitableCount || 0 })] }),
						/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "אינן מתאימות" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: o.notSuitableCount || 0 })] }),
						/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "דורשות סקירה" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: o.requiresReviewCount || 0 })] }),
						/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "קריאות למודל" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: o.modelCallCount || 0 })] }),
						/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "כתיבות אמת חוזית" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: o.contractTruthWriteCount || 0 })] }),
						/* @__PURE__ */ (0, x.jsxs)("span", { children: [/* @__PURE__ */ (0, x.jsx)("small", { children: "כתיבות ללוח הזמנים" }), /* @__PURE__ */ (0, x.jsx)("strong", { children: o.scheduleWriteCount || 0 })] })
					]
				}),
				/* @__PURE__ */ (0, x.jsx)("div", {
					className: "contractsMessage is-success",
					role: "status",
					children: "ערכת המסירה הושלמה מתוך ההחלטות השמורות. סוכן החוזים לא בחר פרויקט, יעד או פעילות ולא כתב שורת Schedule."
				}),
				/* @__PURE__ */ (0, x.jsxs)("section", {
					className: "contractsScheduleAuditSection",
					"aria-labelledby": "contracts-indicator-suitable-title",
					children: [/* @__PURE__ */ (0, x.jsxs)("div", {
						className: "contractsSectionHeader",
						children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("h3", {
							id: "contracts-indicator-suitable-title",
							children: "החלטות מתאימות למסירה ל־Indicator"
						}), /* @__PURE__ */ (0, x.jsx)("p", { children: "אלו החלטות שנבדקו, סומנו כבעלות השפעה רלוונטית ואין בהן סתירה פתוחה. ה־Indicator יחליט לבדו אם וכיצד לשבץ אותן." })] }), /* @__PURE__ */ (0, x.jsxs)("span", {
							className: "contractsPlanReady",
							children: [s.length, " החלטות"]
						})]
					}), /* @__PURE__ */ (0, x.jsx)("div", {
						className: "contractsScheduleProjectionList",
						children: s.map((e) => /* @__PURE__ */ (0, x.jsx)(oi, { item: e }, e.decisionId))
					})]
				}),
				/* @__PURE__ */ (0, x.jsxs)("section", {
					className: "contractsScheduleAuditSection",
					"aria-labelledby": "contracts-indicator-review-title",
					children: [/* @__PURE__ */ (0, x.jsxs)("div", {
						className: "contractsSectionHeader",
						children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("h3", {
							id: "contracts-indicator-review-title",
							children: "החלטות הדורשות השלמת סקירה חוזית"
						}), /* @__PURE__ */ (0, x.jsx)("p", { children: "רק כאן נדרשת פעולה נוספת בסוכן החוזים. אין צורך במיפוי או בשיבוץ ללוח הזמנים." })] }), /* @__PURE__ */ (0, x.jsxs)("span", {
							className: "contractsDryBadge",
							children: [c.length, " החלטות"]
						})]
					}), c.length ? /* @__PURE__ */ (0, x.jsx)("div", {
						className: "contractsScheduleProjectionList",
						children: c.map((e) => /* @__PURE__ */ (0, x.jsx)(oi, { item: e }, e.decisionId))
					}) : /* @__PURE__ */ (0, x.jsx)("div", {
						className: "contractsMessage is-success",
						role: "status",
						children: "אין החלטות שממתינות להכרעת התאמה ל־Indicator."
					})]
				}),
				/* @__PURE__ */ (0, x.jsxs)("details", {
					className: "contractsRelationshipEvidence",
					children: [/* @__PURE__ */ (0, x.jsxs)("summary", { children: [
						"הצג ",
						l.length,
						" החלטות שאינן מתאימות למסירה"
					] }), /* @__PURE__ */ (0, x.jsx)("div", {
						className: "contractsScheduleProjectionList",
						children: l.map((e) => /* @__PURE__ */ (0, x.jsx)(oi, { item: e }, e.decisionId))
					})]
				})
			] })
		]
	});
}
function ci() {
	let [e, t] = (0, b.useState)(null), [n, r] = (0, b.useState)(null), [i, a] = (0, b.useState)(""), [o, s] = (0, b.useState)(null), [c, l] = (0, b.useState)(""), [u, d] = (0, b.useState)([]), [f, p] = (0, b.useState)(null), [m, h] = (0, b.useState)(""), [g, _] = (0, b.useState)([]), [v, y] = (0, b.useState)(null), [S, C] = (0, b.useState)(""), [w, T] = (0, b.useState)(null), [E, D] = (0, b.useState)(null), [O, k] = (0, b.useState)(""), [A, j] = (0, b.useState)(null), [M, N] = (0, b.useState)(null), [P, F] = (0, b.useState)(null), [I, L] = (0, b.useState)(""), [R, z] = (0, b.useState)(null), [ee, te] = (0, b.useState)(null), [B, V] = (0, b.useState)(""), [ne, re] = (0, b.useState)(null), [ie, ae] = (0, b.useState)(null), [oe, se] = (0, b.useState)(null), [ce, le] = (0, b.useState)(""), [ue, de] = (0, b.useState)(null), [fe, pe] = (0, b.useState)(null), [me, he] = (0, b.useState)(""), [ge, _e] = (0, b.useState)(null), [ve, ye] = (0, b.useState)(null), [be, xe] = (0, b.useState)(""), [H, Se] = (0, b.useState)(""), [Ce, we] = (0, b.useState)(null), [Te, Ee] = (0, b.useState)(""), [De, Oe] = (0, b.useState)("idle"), [ke, Ae] = (0, b.useState)(""), [je, Me] = (0, b.useState)(null), [U, Ne] = (0, b.useState)(null), [Pe, Fe] = (0, b.useState)(Ar), [Ie, Le] = (0, b.useState)(jr), [Re, ze] = (0, b.useState)("אולם תצוגה הרצליה"), [Be, Ve] = (0, b.useState)(null), [He, Ue] = (0, b.useState)(null), [We, Ge] = (0, b.useState)("clauses"), [Ke, qe] = (0, b.useState)({}), [Je, Ye] = (0, b.useState)(""), [Xe, Ze] = (0, b.useState)(""), [Qe, $e] = (0, b.useState)(""), [et, tt] = (0, b.useState)(null), [nt, rt] = (0, b.useState)(null), [W, G] = (0, b.useState)(""), [it, at] = (0, b.useState)(""), ot = (0, b.useRef)(0), st = (0, b.useRef)(null), ct = (0, b.useRef)(null), lt = (0, b.useRef)(null), ut = (0, b.useRef)(""), dt = (0, b.useRef)(0), ft = (0, b.useRef)(""), pt = (0, b.useRef)(!1);
	function mt(e) {
		return !!(e && e.epoch === ot.current && e.workspaceId === ut.current);
	}
	function ht() {
		st.current && clearTimeout(st.current), st.current = null;
	}
	function gt(e) {
		if (!mt(e) || pt.current) return;
		ht();
		let t = Math.max(0, e.readyAt - Date.now());
		st.current = setTimeout(() => {
			st.current = null, _t();
		}, t);
	}
	async function _t() {
		if (ct.current || pt.current) return;
		let e = lt.current;
		if (!mt(e)) {
			lt.current = null;
			return;
		}
		if (lt.current = null, e.snapshot === ft.current) {
			Oe("saved"), Ae("");
			return;
		}
		let t = dt.current;
		ct.current = e, Oe("saving"), Ae("");
		try {
			let n = await q(`/api/contracts/workspaces/${e.workspaceId}/draft`, {
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
			if (mt(e)) {
				dt.current = r, ft.current = e.snapshot, we((t) => t?.workspaceId === e.workspaceId ? {
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
				let t = lt.current;
				mt(t) && t.snapshot !== e.snapshot ? Oe("pending") : Oe("saved"), Ct();
			}
		} catch (t) {
			if (mt(e) && (t?.status === 409 || t?.code === "contracts_workspace_draft_stale")) {
				pt.current = !0, ot.current += 1, lt.current = null, ht();
				try {
					zt((await q(`/api/contracts/workspaces/${e.workspaceId}`)).workspace, "", { autosaveConflictMessage: "הטיוטה השתנתה בחלון אחר. נטענה הגרסה העדכנית מהשרת; השינויים המקומיים שלא נשמרו לא הוחלו ולא דרסו החלטות חדשות יותר." });
				} catch {
					Oe("conflict"), Ae("זוהתה טיוטה חדשה יותר ולא בוצעה דריסה. לא ניתן היה לטעון אותה כעת; יש לפתוח מחדש את החוזה השמור לפני עריכה נוספת.");
				}
			} else mt(e) && (Oe("error"), Ae(K(t)));
		} finally {
			ct.current === e && (ct.current = null);
			let t = lt.current;
			mt(t) && !pt.current && gt(t);
		}
	}
	(0, b.useEffect)(() => {
		q("/api/contracts/review/status").then(t).catch((e) => at(K(e))), q("/api/contracts/activity-mapping/status").then(r).catch((e) => a(K(e))), q("/api/contracts/workspaces/status").then((e) => {
			s(e), e.ready && Ct(e);
		}).catch((e) => l(K(e))), q("/api/contracts/clauses/status").then((e) => {
			p(e), e.ready && wt(e);
		}).catch((e) => h(K(e))), q("/api/contracts/relationships/status").then(y).catch((e) => C(K(e))), q("/api/contracts/relationships/semantic/status").then(D).catch((e) => k(K(e))), q("/api/contracts/relationships/review/status").then(N).catch((e) => L(K(e))), q("/api/contracts/relationships/auto-review/status").then(z).catch((e) => V(K(e))), q("/api/contracts/decisions/status").then(re).catch((e) => le(K(e))), q("/api/contracts/decisions/auto-review/status").then(de).catch((e) => he(K(e))), q("/api/contracts/decisions/lineage/status").then(ae).catch((e) => le(K(e))), q("/api/contracts/decisions/indicator-handoff/status").then(_e).catch((e) => xe(K(e)));
	}, []), (0, b.useEffect)(() => {
		if (!o?.ready || !/^[0-9a-f-]{36}$/iu.test(Pe.trim())) return;
		let e = setTimeout(() => Ct(), 350);
		return () => clearTimeout(e);
	}, [Pe, o?.ready]), (0, b.useEffect)(() => {
		if (!f?.ready || !/^[0-9a-f-]{36}$/iu.test(Pe.trim())) return;
		let e = setTimeout(() => wt(), 350);
		return () => clearTimeout(e);
	}, [Pe, f?.ready]), (0, b.useEffect)(() => {
		!M?.ready || !H || Ot(H);
	}, [H, M?.ready]), (0, b.useEffect)(() => {
		!ne?.applyApproved || !H || kt(H);
	}, [
		H,
		ne?.applyApproved,
		ie?.ready
	]), (0, b.useEffect)(() => {
		ye(null), xe(""), te(null), V(""), pe(null), he("");
	}, [H]), (0, b.useEffect)(() => {
		if (!o?.ready || !Ce?.workspaceId || !Be || !Xe || !Qe || pt.current) return;
		let e = Hr({
			decisions: Ke,
			reviewReason: Je,
			batchId: Xe,
			reviewedAt: Qe,
			mappingDraft: je
		}), t = Ur(e), n = ct.current;
		if (t === ft.current && !mt(n)) {
			lt.current = null, ht(), Oe(Ce.draft ? "saved" : "idle"), Ae("");
			return;
		}
		let r = {
			epoch: ot.current,
			workspaceId: Ce.workspaceId,
			payload: e,
			snapshot: t,
			readyAt: Date.now() + 700
		};
		return lt.current = r, Oe("pending"), Ae(""), gt(r), ht;
	}, [
		Ke,
		Je,
		Xe,
		Qe,
		je,
		Be?.document?.documentVersionId,
		Ce?.workspaceId,
		o?.ready
	]), (0, b.useEffect)(() => () => {
		ot.current += 1, lt.current = null, ht();
	}, []);
	let vt = Be?.candidates?.length || 0, yt = Be?.document?.documentVersionId || "", bt = (0, b.useMemo)(() => Object.values(Ke).filter((e) => e.action === "approve").length, [Ke]), xt = vt - bt, St = Dn(et?.plan);
	async function Ct(e = o) {
		if (!(!e?.ready || !/^[0-9a-f-]{36}$/iu.test(Pe.trim()))) try {
			d((await q(`/api/contracts/workspaces?${new URLSearchParams({
				sourceProjectId: Pe.trim(),
				limit: "50"
			})}`)).items || []), l("");
		} catch (e) {
			d([]), l(K(e));
		}
	}
	async function wt(e = f) {
		if (!(!e?.ready || !/^[0-9a-f-]{36}$/iu.test(Pe.trim()))) try {
			_((await q(`/api/contracts/clauses/workspaces?${new URLSearchParams({
				sourceProjectId: Pe.trim(),
				limit: "50"
			})}`)).items || []), h("");
		} catch (e) {
			_([]), h(K(e));
		}
	}
	async function Tt(e) {
		G("open-clause-workspace"), h("");
		try {
			let t = await q(`/api/contracts/clauses/workspaces/${e}`, { timeoutMs: 6e4 });
			Ue(t.preview), Ge("clauses"), Se(t.workspace?.workspaceId || e), T(null), j(null), k(""), F(null), L(""), se(null), le(""), pe(null), he(""), ye(null), xe(""), Ne(null), ze(t.workspace?.projectSite || ""), Ee("תוצאת סוכן החוזים נטענה מהשמירה ללא קריאה חוזרת למודל וללא המתנה לחילוץ."), at(""), v?.ready && await Et(t.workspace?.workspaceId || e);
		} catch (e) {
			h(K(e));
		} finally {
			G("");
		}
	}
	async function Et(e) {
		if (!(!v?.ready || !e)) try {
			T(await q(`/api/contracts/relationships/workspaces/${e}`, { timeoutMs: 6e4 })), C("");
		} catch (e) {
			T(null), C(K(e));
		}
	}
	async function Dt() {
		if (!H) return C("יש לפתוח תחילה חילוץ סעיפים שמור.");
		if (!v?.ready) return C("שמירת קשרי R4.0 עדיין אינה מופעלת בשרת.");
		G("relationships-persist"), C("");
		try {
			T(await q(`/api/contracts/relationships/workspaces/${H}/explicit`, {
				method: "POST",
				timeoutMs: 6e4
			}));
		} catch (e) {
			C(K(e));
		} finally {
			G("");
		}
	}
	async function Ot(e) {
		if (!(!M?.ready || !e)) try {
			F(await q(`/api/contracts/relationships/workspaces/${e}/semantic-review`, { timeoutMs: 6e4 })), L("");
		} catch (e) {
			F(null), L(K(e));
		}
	}
	async function kt(e) {
		if (!(!ne?.applyApproved || !e)) try {
			se(await q(ie?.ready ? `/api/contracts/decisions/workspaces/${e}/lineage` : `/api/contracts/decisions/workspaces/${e}`, { timeoutMs: 6e4 })), le(""), ye(null);
		} catch (e) {
			se(null), le(K(e));
		}
	}
	async function At() {
		if (!H) return xe("יש לפתוח תחילה חילוץ סעיפים שמור.");
		if (!ge?.ready) return xe("ערכת המסירה ל־Indicator עדיין אינה מופעלת בתהליך השרת הנוכחי.");
		G("indicator-handoff"), xe(""), ye(null);
		try {
			ye(await q(`/api/contracts/decisions/workspaces/${H}/indicator-handoff`, { timeoutMs: 9e4 }));
		} catch (e) {
			xe(K(e));
		} finally {
			G("");
		}
	}
	async function jt() {
		if (!H) return k("יש לפתוח תחילה חילוץ סעיפים שמור.");
		if (!E?.ready) return k("תצוגת קשרי R4.1 עדיין אינה מופעלת או שמפתח המודל אינו מוגדר בשרת.");
		G("semantic-relationships"), k(""), j(null);
		try {
			let e = await q(M?.ready ? `/api/contracts/relationships/workspaces/${H}/semantic-proposals` : `/api/contracts/relationships/workspaces/${H}/semantic-preview`, {
				method: "POST",
				body: {},
				timeoutMs: 21e4
			});
			e.analysis && e.review ? (j(e.analysis), F(e.review), L(""), ne?.applyApproved && await kt(H)) : j(e);
		} catch (e) {
			k(K(e));
		} finally {
			G("");
		}
	}
	async function Mt(e, t, n) {
		if (!H || !e?.relationshipId) return L("הצעת הקשר השמורה אינה זמינה לסקירה.");
		G(`relationship-review:${e.relationshipId}`), L("");
		try {
			F(await q(`/api/contracts/relationships/workspaces/${H}/semantic-review/${e.relationshipId}`, {
				method: "POST",
				body: {
					expectedRevision: e.revision,
					action: t,
					reasonHe: n.reasonHe,
					...n.correction ? { correction: n.correction } : {}
				},
				timeoutMs: 6e4
			})), ne?.applyApproved && await kt(H);
		} catch (e) {
			L(K(e)), e?.status === 409 && await Ot(H);
		} finally {
			G("");
		}
	}
	async function Nt() {
		if (!H) return V("יש לפתוח תחילה חילוץ סעיפים שמור.");
		if (!R?.ready) return V("מיגרציית R4.2A.1 לאישור אוטומטי עדיין אינה זמינה ב־KAPAIM.");
		G("relationship-auto-review"), V(""), te(null);
		try {
			let e = await q(`/api/contracts/relationships/workspaces/${H}/semantic-auto-review`, {
				method: "POST",
				body: {},
				timeoutMs: 6e4
			});
			te(e), F(e.review), ne?.applyApproved && await kt(H);
		} catch (e) {
			V(K(e)), e?.status === 409 && await Ot(H);
		} finally {
			G("");
		}
	}
	async function Pt() {
		if (!H) return le("יש לפתוח תחילה חילוץ סעיפים שמור.");
		if (!ne?.ready) return le("R4.2B עדיין אינו מופעל או שמפתח המודל אינו מוגדר בשרת.");
		if (Number(oe?.metrics?.pendingRelationshipCount || 0) > 0) return le("יש לסיים תחילה את סקירת כל הקשרים השמורים.");
		G("decision-proposals"), le("");
		try {
			se((await q(`/api/contracts/decisions/workspaces/${H}/proposals`, {
				method: "POST",
				body: {},
				timeoutMs: 27e4
			})).review), ye(null);
		} catch (e) {
			le(K(e)), e?.status === 409 && await kt(H);
		} finally {
			G("");
		}
	}
	async function Ft() {
		if (!H) return he("יש לפתוח תחילה חילוץ סעיפים שמור.");
		if (!ue?.ready) return he("R4.2B.1 עדיין אינו מופעל או שמפתח המודל אינו מוגדר בשרת.");
		if (!(Number(oe?.metrics?.proposedCount || 0) < 1)) {
			G("decision-auto-review"), he(""), pe(null);
			try {
				pe(await q(`/api/contracts/decisions/workspaces/${H}/auto-review`, {
					method: "POST",
					body: {},
					timeoutMs: 3e5
				})), ye(null), await kt(H);
			} catch (e) {
				he(K(e)), e?.status === 409 && await kt(H);
			} finally {
				G("");
			}
		}
	}
	async function It(e, t, n) {
		if (!H || !e?.decisionId) return le("הצעת ההחלטה השמורה אינה זמינה לסקירה.");
		G(`decision-review:${e.decisionId}`), le("");
		try {
			se(await q(`/api/contracts/decisions/workspaces/${H}/review/${e.decisionId}`, {
				method: "POST",
				body: {
					expectedRevision: e.revision,
					action: t,
					reasonHe: n.reasonHe,
					...n.correction ? { correction: n.correction } : {}
				},
				timeoutMs: 6e4
			})), ye(null);
		} catch (e) {
			le(K(e)), e?.status === 409 && await kt(H);
		} finally {
			G("");
		}
	}
	async function Lt(e, t) {
		if (!H || !e?.decisionId || !ie?.ready) return le("פעולת הפיצול של R4.2C אינה זמינה כעת.");
		G(`decision-lineage:${e.decisionId}`), le("");
		try {
			se(await q(`/api/contracts/decisions/workspaces/${H}/lineage/split/${e.decisionId}`, {
				method: "POST",
				body: t,
				timeoutMs: 6e4
			})), ye(null);
		} catch (e) {
			le(K(e)), e?.status === 409 && await kt(H);
		} finally {
			G("");
		}
	}
	async function Rt(e) {
		if (!H || !ie?.ready) return le("פעולת המיזוג של R4.2C אינה זמינה כעת.");
		G("decision-lineage:merge"), le("");
		try {
			se(await q(`/api/contracts/decisions/workspaces/${H}/lineage/merge`, {
				method: "POST",
				body: e,
				timeoutMs: 6e4
			})), ye(null);
		} catch (e) {
			le(K(e)), e?.status === 409 && await kt(H);
		} finally {
			G("");
		}
	}
	function zt(e, t = "", { autosaveConflictMessage: n = "", preserveClausePreview: r = !1, preserveFile: i = !1 } = {}) {
		let a = e.extraction, o = Vr(a, e.draft), s = Hr(o);
		ht(), ot.current += 1, lt.current = null, pt.current = !!n, ut.current = e.workspaceId, dt.current = Wr(e.draft), ft.current = Ur(s), Oe(n ? "conflict" : e.draft ? "saved" : "idle"), Ae(n), Ve(a), qe(o.decisions), Ye(o.reviewReason), Ze(o.batchId), $e(o.reviewedAt), Me(o.mappingDraft), Fe(e.sourceProjectId || a.projectBinding?.projectId || Ar), Le(e.scheduleProjectId || jr), ze(e.projectSite || a.projectBinding?.projectSite || ""), we(e), Ee(t), tt(null), rt(null), at(""), r || Ue(null), i || Ne(null);
	}
	async function Bt(e) {
		G("open-workspace"), l("");
		try {
			zt((await q(`/api/contracts/workspaces/${e}`)).workspace, "החוזה והחלטות הטיוטה נטענו ללא קריאה חדשה למודל.");
		} catch (e) {
			l(K(e));
		} finally {
			G("");
		}
	}
	function Vt(e, t) {
		qe((n) => ({
			...n,
			[e]: {
				...n[e],
				...t
			}
		})), tt(null), rt(null);
	}
	function Ht() {
		if (!Be) return "יש להריץ חילוץ לפני סקירה.";
		if (Je.trim().length < 10) return "נדרש נימוק סקירה כללי של לפחות 10 תווים.";
		for (let e of Be.candidates || []) {
			let t = Ke[e.candidateKey];
			if (!t?.reason?.trim()) return "נדרש נימוק לכל החלטה.";
			if (t.action === "approve" && !t.gatesReviewed) return "יש לאשר במפורש שהחסמים נבדקו לכל מועמד שמקודם.";
			if (t.action === "approve" && e.conflictGroupId && !t.conflictReason.trim()) return "נדרש נימוק מפורש לפתרון סתירה.";
		}
		return "";
	}
	async function Ut() {
		if (!U) return at("יש לבחור קובץ PDF.");
		G("extract"), at(""), l(""), Ee(""), tt(null), rt(null);
		try {
			let e = await Ir(U), t = {
				filename: U.name,
				mediaType: "application/pdf",
				pdfBase64: e,
				mode: "dry_run",
				projectSelection: {
					projectId: Pe.trim(),
					projectSite: Re.trim(),
					selectedByUser: !0
				}
			}, n = o?.ready ? await q("/api/contracts/workspaces/extract", {
				method: "POST",
				timeoutMs: 3e5,
				body: {
					extractionRequest: t,
					scheduleProjectId: Ie.trim()
				}
			}) : await q("/api/contracts/extract", {
				method: "POST",
				timeoutMs: 3e5,
				body: t
			}), r = n.extraction || n, i = Vr(r, n.draft);
			if (o?.ready) {
				let e = n.reused ? "החוזה כבר היה שמור: החילוץ והטיוטה נטענו ללא קריאת מודל וללא עלות טוקנים נוספת." : "החוזה, ה-PDF ותוצאת החילוץ נשמרו. השינויים בהחלטות יישמרו אוטומטית.";
				zt({
					...n.workspace,
					extraction: r,
					draft: n.draft || null
				}, e, {
					preserveClausePreview: !0,
					preserveFile: !0
				}), Ct();
			} else ut.current = "", dt.current = 0, ft.current = "", we(null), Ve(r), qe(i.decisions), Ze(i.batchId), $e(i.reviewedAt), Ye(i.reviewReason), Me(i.mappingDraft), Ee("השמירה הקבועה עדיין אינה מופעלת בשרת; החילוץ נשמר רק במסך הנוכחי.");
		} catch (e) {
			at(K(e));
		} finally {
			G("");
		}
	}
	async function Wt() {
		if (!U) return at("יש לבחור קובץ PDF.");
		if (!f?.ready) return at("שמירת תוצאת סוכן החוזים עדיין אינה מופעלת בשרת.");
		G("clause-persist"), at(""), Ee("");
		try {
			let e = await Ir(U), t = await q("/api/contracts/clauses/workspaces/extract", {
				method: "POST",
				timeoutMs: 3e5,
				body: {
					filename: U.name,
					mediaType: "application/pdf",
					pdfBase64: e,
					mode: "persist",
					projectSelection: {
						projectId: Pe.trim(),
						projectSite: Re.trim(),
						selectedByUser: !0
					}
				}
			});
			Ue(t), Ge("clauses"), Se(t.workspace?.workspaceId || ""), T(null), C(""), j(null), k(""), F(null), L(""), Ee(t.modelAvoided ? "החילוץ הזה כבר היה שמור ונטען מיד, ללא קריאה חוזרת למודל." : "ה־PDF וכל תוצאת סוכן החוזים נשמרו. מעכשיו אפשר לפתוח אותם מחדש ללא חילוץ חוזר."), wt();
		} catch (e) {
			at(K(e));
		} finally {
			G("");
		}
	}
	async function Gt() {
		let e = Ht();
		if (e) return at(e);
		G("plan"), at("");
		try {
			tt(await q("/api/contracts/review/plan", {
				method: "POST",
				body: qr({
					extraction: Be,
					decisions: Ke,
					reviewReason: Je,
					batchId: Xe,
					reviewedAt: Qe,
					sourceProjectId: Pe,
					scheduleProjectId: Ie
				})
			})), rt(null);
		} catch (e) {
			at(K(e));
		} finally {
			G("");
		}
	}
	async function Kt(e) {
		if (!et) return at("יש להכין ולאמת את תוכנית הסקירה לפני השמירה או הקידום.");
		if (e !== St || e === En.blocked) return at("תוכנית הסקירה אינה מוכנה לפעולה בטוחה.");
		let t = e === En.reviewOnly;
		G(t ? "save-review" : "commit"), at("");
		try {
			let e = qr({
				extraction: Be,
				decisions: Ke,
				reviewReason: Je,
				batchId: Xe,
				reviewedAt: Qe,
				sourceProjectId: Pe,
				scheduleProjectId: Ie
			});
			rt(await q(t ? "/api/contracts/review/save" : "/api/contracts/review/commit", {
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
			at(K(e));
		} finally {
			G("");
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
						children: "סוכן חוזים · R3.2 + שלב 2 + שלב 3F + שלב 3F.1"
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
						}),
						/* @__PURE__ */ (0, x.jsxs)("div", {
							className: `contractsMode ${f?.ready ? "is-ready" : "is-paused"}`,
							children: [/* @__PURE__ */ (0, x.jsx)("strong", { children: f?.ready ? "שמירת כל סעיפי החוזה פעילה" : "שמירת כל הסעיפים ממתינה להפעלה" }), /* @__PURE__ */ (0, x.jsxs)("span", { children: ["R3.2 · גרסת תשתית ", f?.migrationVersion || "—"] })]
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, x.jsxs)("section", {
				className: "contractsPanel contractsWorkspacePanel contractsClauseWorkspacePanel",
				children: [
					/* @__PURE__ */ (0, x.jsxs)("div", {
						className: "contractsSectionHeader",
						children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("h2", { children: "חילוצי סוכן החוזים שנשמרו" }), /* @__PURE__ */ (0, x.jsx)("p", { children: "פתיחה מכאן טוענת את כל הסעיפים, התקצירים, התגיות וההפניות ללא העלאת PDF וללא קריאה נוספת למודל." })] }), /* @__PURE__ */ (0, x.jsx)("span", {
							className: f?.ready ? "contractsPlanReady" : "contractsPlanBlocked",
							children: f?.ready ? "שמירת R3.2 פעילה" : "שמירת R3.2 מושבתת"
						})]
					}),
					!f?.ready && /* @__PURE__ */ (0, x.jsx)("p", {
						className: "contractsActivationNotice",
						children: m || "מיגרציית R3.2 והפעלת השרת עדיין נדרשות לפני שמירת חילוצי הסעיפים."
					}),
					f?.ready && g.length === 0 && /* @__PURE__ */ (0, x.jsx)("p", {
						className: "contractsMappingEmpty",
						children: "אין עדיין חילוצי סעיפים שמורים לפרויקט MAIN הנבחר."
					}),
					f?.ready && g.length > 0 && /* @__PURE__ */ (0, x.jsx)("div", {
						className: "contractsSavedList",
						"aria-label": "חילוצי סעיפים שמורים",
						children: g.map((e) => /* @__PURE__ */ (0, x.jsxs)("article", { children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [
							/* @__PURE__ */ (0, x.jsx)("strong", { children: e.projectSite || e.filename }),
							/* @__PURE__ */ (0, x.jsxs)("span", { children: [
								e.filename,
								" · ",
								e.clauseCount,
								" רשומות · ",
								e.pageCount,
								" עמודים"
							] }),
							/* @__PURE__ */ (0, x.jsxs)("small", { children: ["נשמר ", kr(e.createdAt)] }),
							/* @__PURE__ */ (0, x.jsx)("small", {
								dir: "ltr",
								children: e.documentVersionId
							})
						] }), /* @__PURE__ */ (0, x.jsx)("button", {
							type: "button",
							disabled: !!W,
							onClick: () => Tt(e.workspaceId),
							children: W === "open-clause-workspace" ? "פותח…" : "פתח ללא חילוץ חוזר"
						})] }, e.workspaceId))
					}),
					f?.ready && m && /* @__PURE__ */ (0, x.jsx)("div", {
						className: "contractsMessage is-error",
						role: "alert",
						children: m
					})
				]
			}),
			/* @__PURE__ */ (0, x.jsxs)("section", {
				className: "contractsPanel contractsWorkspacePanel",
				children: [
					/* @__PURE__ */ (0, x.jsxs)("div", {
						className: "contractsSectionHeader",
						children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("h2", { children: "חוזים שמורים — חילוץ קלאסי והמשך עבודה" }), /* @__PURE__ */ (0, x.jsx)("p", { children: "פתיחה מחדש אינה שולחת את ה-PDF למודל. כל גרסת מסמך נשמרת בנפרד והחלטות אינן מועתקות אוטומטית לגרסה חדשה." })] }), /* @__PURE__ */ (0, x.jsx)("span", {
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
							/* @__PURE__ */ (0, x.jsx)("small", { children: e.draft ? `${e.draft.reviewedCount}/${e.candidateCount} החלטות עם נימוק · נשמר ${kr(e.draft.updatedAt)}` : `טרם נשמרה טיוטת החלטות · נוצר ${kr(e.createdAt)}` }),
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
							disabled: !!W,
							onClick: () => Bt(e.workspaceId),
							children: W === "open-workspace" ? "פותח…" : "פתח והמשך"
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
								onChange: (e) => {
									Ne(e.target.files?.[0] || null), Ue(null), Ge("clauses"), Se(""), T(null), C(""), j(null), k(""), F(null), L(""), se(null), le(""), pe(null), he(""), ye(null), xe("");
								}
							})] }),
							/* @__PURE__ */ (0, x.jsxs)("label", { children: ["אתר / תיאור פרויקט", /* @__PURE__ */ (0, x.jsx)("input", {
								value: Re,
								onChange: (e) => ze(e.target.value)
							})] }),
							/* @__PURE__ */ (0, x.jsxs)("label", { children: ["מזהה פרויקט מקור ב־MAIN", /* @__PURE__ */ (0, x.jsx)("input", {
								dir: "ltr",
								value: Pe,
								onChange: (e) => Fe(e.target.value)
							})] }),
							/* @__PURE__ */ (0, x.jsxs)("label", { children: ["מזהה פרויקט לוח זמנים ב־KAPAIM", /* @__PURE__ */ (0, x.jsx)("input", {
								dir: "ltr",
								value: Ie,
								onChange: (e) => Le(e.target.value)
							})] })
						]
					}),
					/* @__PURE__ */ (0, x.jsxs)("div", {
						className: "contractsUploadActions",
						children: [/* @__PURE__ */ (0, x.jsx)("button", {
							type: "button",
							className: "contractsPrimary",
							disabled: !!W || !f?.ready,
							onClick: Wt,
							children: W === "clause-persist" ? "מפרק, מעשיר ושומר את כל סעיפי החוזה…" : "חלץ ושמור את כל תוצאת סוכן החוזים"
						}), /* @__PURE__ */ (0, x.jsx)("button", {
							type: "button",
							className: "contractsSecondary",
							disabled: !!W,
							onClick: Ut,
							children: W === "extract" ? "בודק אם החוזה שמור, ומחלץ רק אם נדרש…" : o?.ready ? "הרץ גם את החילוץ הקלאסי ושמור" : "הרץ גם את החילוץ הקלאסי"
						})]
					}),
					/* @__PURE__ */ (0, x.jsx)("p", {
						className: "contractsFieldHint",
						children: "תוצאת הסעיפים נשמרת ב־KAPAIM ובאחסון הפרטי וניתנת לפתיחה מחדש ללא חילוץ חוזר. לאחר הפתיחה סוכן הקשרים מציג את ההפניות המפורשות בנפרד. הכפתור השני משאיר את מסלול החילוץ הקלאסי זמין להשוואה."
					}),
					Te && /* @__PURE__ */ (0, x.jsx)("div", {
						className: "contractsMessage is-success",
						role: "status",
						children: Te
					})
				]
			}),
			He && /* @__PURE__ */ (0, x.jsxs)("section", {
				className: "contractsWorkspaceTabsShell",
				"aria-labelledby": "contracts-open-workspace-title",
				children: [
					/* @__PURE__ */ (0, x.jsxs)("div", {
						className: "contractsWorkspaceTabsHeader",
						children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [
							/* @__PURE__ */ (0, x.jsx)("p", {
								className: "contractsEyebrow",
								children: "חוזה פתוח · סביבת עבודה שמורה"
							}),
							/* @__PURE__ */ (0, x.jsx)("h2", {
								id: "contracts-open-workspace-title",
								children: Re || He.document?.filename || "חוזה שמור"
							}),
							/* @__PURE__ */ (0, x.jsxs)("p", { children: [He.document?.filename || "", " · בחרו שלב כדי להציג רק את המידע הרלוונטי."] })
						] }), /* @__PURE__ */ (0, x.jsx)("span", {
							className: "contractsPlanReady",
							children: "החילוץ השמור נשאר טעון בעת מעבר בין הכרטיסיות"
						})]
					}),
					/* @__PURE__ */ (0, x.jsx)(Pr, {
						activeTab: We,
						onChange: Ge
					}),
					/* @__PURE__ */ (0, x.jsx)(Fr, {
						id: "clauses",
						activeTab: We,
						children: /* @__PURE__ */ (0, x.jsx)(Yr, {
							preview: He,
							classicDocumentVersionId: yt
						})
					}),
					/* @__PURE__ */ (0, x.jsx)(Fr, {
						id: "relationships",
						activeTab: We,
						children: /* @__PURE__ */ (0, x.jsx)($r, {
							preview: He,
							workspaceId: H,
							persistenceStatus: v,
							persistenceResult: w,
							persistenceError: S,
							persistenceBusy: W === "relationships-persist",
							onPersist: Dt,
							semanticStatus: E,
							semanticResult: A,
							semanticError: O,
							semanticBusy: W === "semantic-relationships",
							onRunSemantic: jt,
							reviewStatus: M,
							reviewResult: P,
							reviewError: I,
							reviewBusyId: W.startsWith("relationship-review:") ? W.slice(20) : "",
							onReview: Mt,
							autoReviewStatus: R,
							autoReviewResult: ee,
							autoReviewError: B,
							autoReviewBusy: W === "relationship-auto-review",
							onAutoReview: Nt
						})
					}),
					/* @__PURE__ */ (0, x.jsx)(Fr, {
						id: "decisions",
						activeTab: We,
						children: /* @__PURE__ */ (0, x.jsx)(ai, {
							status: ne,
							lineageStatus: ie,
							result: oe,
							autoReviewStatus: ue,
							autoReviewResult: fe,
							autoReviewError: me,
							autoReviewBusy: W === "decision-auto-review",
							relationshipPendingCount: P?.metrics?.proposedCount || 0,
							error: ce,
							generationBusy: W === "decision-proposals",
							reviewBusyId: W.startsWith("decision-review:") ? W.slice(16) : W === "decision-lineage:merge" ? "lineage:merge" : W.startsWith("decision-lineage:") ? `lineage:${W.slice(17)}` : "",
							onGenerate: Pt,
							onAutoReview: Ft,
							onSplit: Lt,
							onMerge: Rt,
							onReview: It
						})
					}),
					/* @__PURE__ */ (0, x.jsx)(Fr, {
						id: "indicator",
						activeTab: We,
						children: /* @__PURE__ */ (0, x.jsx)(si, {
							status: ge,
							result: ve,
							error: be,
							busy: W === "indicator-handoff",
							disabled: !!W,
							onRun: At
						})
					})
				]
			}),
			Be && /* @__PURE__ */ (0, x.jsxs)("section", {
				className: "contractsPanel",
				children: [
					/* @__PURE__ */ (0, x.jsxs)("div", {
						className: "contractsSectionHeader",
						children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [
							/* @__PURE__ */ (0, x.jsx)("p", {
								className: "contractsEyebrow",
								children: "חילוץ קלאסי · תצוגת השוואה"
							}),
							/* @__PURE__ */ (0, x.jsx)("h2", { children: "תוצאת הסוכן הקלאסי: סקירת מועמדים" }),
							/* @__PURE__ */ (0, x.jsxs)("p", { children: [
								vt,
								" מועמדים · ",
								bt,
								" לאישור · ",
								xt,
								" לדחייה"
							] })
						] }), /* @__PURE__ */ (0, x.jsxs)("div", {
							className: "contractsWorkspaceSaveState",
							role: "status",
							children: [/* @__PURE__ */ (0, x.jsx)("span", {
								className: "contractsDryBadge",
								children: "חילוץ יבש · ללא כתיבה ללוח"
							}), Ce?.workspaceId && /* @__PURE__ */ (0, x.jsx)("span", {
								className: `contractsAutosave is-${De}`,
								children: De === "saving" || De === "pending" ? "שומר טיוטה…" : De === "conflict" ? "זוהתה טיוטה חדשה יותר" : De === "idle" ? "טרם בוצעו שינויים בטיוטה" : De === "error" ? "השמירה האוטומטית נכשלה" : "כל שינויי הטיוטה נשמרו"
							})]
						})]
					}),
					ke && /* @__PURE__ */ (0, x.jsx)("div", {
						className: "contractsMessage is-error",
						role: "alert",
						children: ke
					}),
					/* @__PURE__ */ (0, x.jsx)("div", {
						className: "contractsCandidateList",
						children: (Be.candidates || []).map((e) => /* @__PURE__ */ (0, x.jsx)(Jr, {
							candidate: e,
							decision: Ke[e.candidateKey],
							onChange: (t) => Vt(e.candidateKey, t)
						}, e.candidateKey))
					}),
					/* @__PURE__ */ (0, x.jsxs)("label", {
						className: "contractsReviewReason",
						children: ["נימוק סקירה כללי", /* @__PURE__ */ (0, x.jsx)("textarea", {
							rows: "3",
							value: Je,
							onChange: (e) => {
								Ye(e.target.value), tt(null);
							}
						})]
					}),
					/* @__PURE__ */ (0, x.jsx)("button", {
						type: "button",
						className: "contractsPrimary",
						disabled: !!W,
						onClick: Gt,
						children: W === "plan" ? "בודק תוכנית…" : "הכן ובדוק תוכנית קידום"
					})
				]
			}),
			et && /* @__PURE__ */ (0, x.jsxs)("section", {
				className: "contractsPanel contractsPlanPanel",
				children: [
					/* @__PURE__ */ (0, x.jsxs)("div", {
						className: "contractsSectionHeader",
						children: [/* @__PURE__ */ (0, x.jsxs)("div", { children: [/* @__PURE__ */ (0, x.jsx)("h2", { children: "3. תוכנית טרנזקציה" }), /* @__PURE__ */ (0, x.jsxs)("p", { children: [
							"מצב: ",
							xr(et.plan?.status),
							" · פעולה בטוחה: ",
							St === En.promotion ? "קידום עובדות מאושרות" : St === En.reviewOnly ? "שמירת סקירה בלבד" : "אין"
						] })] }), /* @__PURE__ */ (0, x.jsx)("span", {
							className: St === En.blocked ? "contractsPlanBlocked" : "contractsPlanReady",
							children: St === En.promotion ? "מוכן לקידום" : St === En.reviewOnly ? "מוכן לשמירת סקירה" : "חסום"
						})]
					}),
					(et.plan?.globalBlockers || []).length > 0 && /* @__PURE__ */ (0, x.jsx)("ul", {
						className: "contractsBlockers",
						children: et.plan.globalBlockers.map((e) => /* @__PURE__ */ (0, x.jsx)("li", { children: hr(e) }, e))
					}),
					/* @__PURE__ */ (0, x.jsxs)("div", {
						className: "contractsPlanCounts",
						children: [
							/* @__PURE__ */ (0, x.jsxs)("span", { children: ["אבני דרך ", /* @__PURE__ */ (0, x.jsx)("strong", { children: et.plan?.rowsByTable?.schedule_contract_milestones?.length || 0 })] }),
							/* @__PURE__ */ (0, x.jsxs)("span", { children: ["הארכות ", /* @__PURE__ */ (0, x.jsx)("strong", { children: et.plan?.rowsByTable?.schedule_contract_extensions?.length || 0 })] }),
							/* @__PURE__ */ (0, x.jsxs)("span", { children: ["תנאים ", /* @__PURE__ */ (0, x.jsx)("strong", { children: et.plan?.rowsByTable?.schedule_contract_conditions?.length || 0 })] })
						]
					}),
					St === En.reviewOnly && /* @__PURE__ */ (0, x.jsxs)("div", {
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
								disabled: !!W || !e?.applyApproved,
								onClick: () => Kt(En.reviewOnly),
								children: W === "save-review" ? "שומר סקירה ללא קידום…" : "שמור סקירה ללא קידום"
							})
						]
					}),
					St === En.promotion && /* @__PURE__ */ (0, x.jsxs)("div", {
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
								disabled: !!W || !e?.applyApproved,
								onClick: () => Kt(En.promotion),
								children: W === "commit" ? "מבצע קידום אטומי…" : "קדם עובדות מאושרות"
							})
						]
					}),
					St === En.blocked && /* @__PURE__ */ (0, x.jsxs)("div", {
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
			Be && /* @__PURE__ */ (0, x.jsx)(Kr, {
				extraction: Be,
				sourceProjectId: Pe.trim(),
				status: n,
				statusError: i,
				savedState: je,
				savedStateKey: Ce?.workspaceId || "",
				onDraftStateChange: Me
			}),
			it && /* @__PURE__ */ (0, x.jsx)("div", {
				className: "contractsMessage is-error",
				role: "alert",
				children: it
			}),
			nt && /* @__PURE__ */ (0, x.jsx)("div", {
				className: "contractsMessage is-success",
				children: nt.status === "reviewed_no_promotion" ? "הסקירה נשמרה ביומן הביקורת בלבד. לא קודמו ולא נוצרו רשומות לו״ז." : `הקידום הושלם. קודמו ${nt.promotedCount} רשומות.`
			})
		]
	});
}
//#endregion
//#region src/react/main.jsx
var li = /* @__PURE__ */ new WeakMap();
function ui({ label: e = "React bridge ready" }) {
	return /* @__PURE__ */ (0, x.jsx)("span", {
		className: "reactBridgeStatus",
		"data-react-ready": "true",
		children: e
	});
}
var di = {
	status: ui,
	settings: je,
	workflow: Ie,
	insights: $e,
	schedule: Tn,
	contracts: ci
};
function fi(e) {
	let t = di[e.dataset.reactIsland];
	if (!t || li.has(e)) return !1;
	let n = e.dataset.reactProps ? JSON.parse(e.dataset.reactProps) : {}, r = (0, y.createRoot)(e);
	return r.render(/* @__PURE__ */ (0, x.jsx)(b.StrictMode, { children: /* @__PURE__ */ (0, x.jsx)(t, { ...n }) })), li.set(e, r), !0;
}
function pi(e = document) {
	return Array.from(e.querySelectorAll("[data-react-island]")).reduce((e, t) => e + +!!fi(t), 0);
}
typeof window < "u" && (window.BiDocReact = {
	islands: Object.keys(di),
	mountReactIslands: pi,
	version: "0.1.0"
}, document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", () => pi(), { once: !0 }) : pi());
//#endregion
export { pi as mountReactIslands };
