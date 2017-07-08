Array.prototype.remove = function(item) {
  if (!this.length) return
  const idx = this.indexOf(item);
  if (idx > -1) return this.splice(idx, 1)
}

export default (Vue, Opt = {}) => {
  const isVue2 = Vue.version.split('.')[0] == '2'
  const IMAGE = 'data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA='
  const EVENTS = ['scroll', 'wheel', 'mousewheel', 'resize', 'animationend', 'transitionend']

  const Options = {
    preLoad: Opt.preLoad || 1.2,
    error: Opt.error || IMAGE,
    loading: Opt.loading || IMAGE,
    try: Opt.try || 3,
    hasBind: false
  }

  // 存储所有lazy元素
  const Listeners = []
  const imgCache = []

  const Tools = {
    throttle(action, delay) {
      let timeout = null
      let lastRun = 0
      return function() {
        if (timeout) {
          return
        }
        let elapsed = Date.now() - lastRun
        let context = this
        let args = arguments
        let runCallback = function() {
          lastRun = Date.now()
          timeout = false
          action.apply(context, args)
        }
        if (elapsed >= delay) {
          runCallback()
        } else {
          timeout = setTimeout(runCallback, delay)
        }
      }
    },
    on(el, ev, fn) {
      el.addEventListener(ev, fn)
    },
    off(el, ev, fn) {
      el.removeEventListener(ev, fn)
    },
  }

  const lazyloadFire = Tools.throttle(() => {
    for (let i = 0, len = Listeners.length; i < len; i++) {
      checkImage(Listeners[i])
    }
  }, 300)

  const events = (el, bind) => {
    if (bind) {
      EVENTS.forEach(evt => {
        Tools.on(el, evt, lazyloadFire)
      })
    } else {
      EVENTS.forEach(evt => {
        Tools.off(el, evt, lazyloadFire)
      })
    }
  }

  // 检查图片是否在可是范围内 
  const checkImage = listener => {
    if (imgCache.indexOf(listener.src) > -1) {
      return render(listener.el, listener.src, 'loaded', listener.bindType)
    }

    const rect = listener.el.getBoundingClientRect()
    if (rect.top < window.innerHeight * Options.preLoad && rect.bottom > 0 && rect.left < window.innerWidth * Options.preLoad && rect.right > 0) {
      load(listener)
    }
  }

  // 加载图片
  const load = item => {
    if (item.try > Options.try) return false;

    item.try++

      loadImg(item, img => {
        render(item.el, item.src, 'loaded', item.bindType)
        imgCache.push(item.src)
        Listeners.remove(item)
      }, error => {
        render(item.el, item.error, 'error', item.bindType)
      })
  }

  // 渲染图片容器
  const render = (el, src, status, bindType) => {
    if (!bindType) {
      el.setAttribute('src', src)
    } else {
      el.setAttribute('style', bindType + ': url(' + src + ')')
    }
    el.setAttribute('lazy', status);
  }

  const loadImg = (item, resolve, reject) => {
    const img = new Image()
    img.src = item.src

    img.onload = () => {
      resolve({
        naturalHeight: img.naturalHeight,
        naturalWidth: img.naturalWidth,
        src: item.src
      })
    }

    img.onerror = (e) => {
      reject(e)
    }
  }


  const isExist = el => {
    let exist = false
    Listeners.forEach(item => {
      if (item.el == el) exist = true
    })

    // 元素存在 加载图片
    if (exist) {
      Vue.nextTick(() => {
        lazyloadFire();
      })
    }
    return exist;
  }
  const addListener = (el, binding, vnode) => {
    if (el.getAttribute('lazy') == 'loaded') return
    if (isExist(el)) return

    let imgSrc = binding.value
    let imgLoading = Options.loading
    let imgError = Options.error

    if (imgCache.indexOf(imgSrc) > -1) {
      return render(el, imgSrc, 'loaded', binding.arg)
    }

    render(el, imgLoading, 'loading', binding.arg)

    Vue.nextTick(() => {
      Listeners.push({
        el: el,
        src: imgSrc,
        error: imgError,
        try: 0,
        bindType: binding.arg
      })

      lazyloadFire()

      // 绑定滚动事件 只绑定一次
      if (Listeners.length > 0 && !Options.hasBind) {
        Options.hasBind = true
        events(window, true)
      }
    })
  }

  const unbind = (el, binding, vnode, oldValue) => {
    if (!el) return

    if (Options.hasBind && Listeners.length == 0) {
      Options.hasBind = false
      Listeners.length = imgCache.length = 0
      events(window, false)
    }
  }


  if (isVue2) {
    Vue.directive('lazy', {
      bind: addListener,
      update: addListener,
      inserted: addListener,
      comppnentUpdated: lazyloadFire,
      unbind: unbind
    })
  } else {
    Vue.directive('lazy', {
      bind: lazyloadFire,
      update(newValue, oldValue) {
        addListener(this.el, {
          modifiers: this.modifiers,
          arg: this.arg,
          value: newValue,
          oldValue: oldValue
        })
      },
      unbind() {
        unbind(this.el)
      }
    })
  }
}
