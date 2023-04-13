/* eslint-disable import/prefer-default-export */
import Vue from 'vue';
import Vuex from 'vuex';
import Vuetify from 'vuetify/lib';

import GirderProvider from 'paraview-glance/src/girder';
import { vuetify as girderVuetify } from '@girder/components/src';

import '@kitware/vtk.js/Rendering/Profiles/All';

import vtkURLExtract from '@kitware/vtk.js/Common/Core/URLExtract';
import vtkProxyManager from '@kitware/vtk.js/Proxy/Core/ProxyManager';

import 'typeface-roboto/index.css';
import '@mdi/font/css/materialdesignicons.css';
import 'paraview-glance/static/global.css';

// side-effect: register readers
// import 'paraview-glance/src/io/ParaViewGlanceReaders';
// side-effect: register presets
import 'paraview-glance/src/config/ColorMaps';

import ReaderFactory from 'paraview-glance/src/io/ReaderFactory';
import App from 'paraview-glance/src/components/core/App';
import Config from 'paraview-glance/src/config';
import createStore from 'paraview-glance/src/store';
import { ProxyManagerVuePlugin } from 'paraview-glance/src/plugins';
import Settings from 'paraview-glance/src/settings';

/**
 * 根据web页面，这段代码是用于创建一个基于Vue.js和VTK.js的Web应用程序，它可以用于可视化和分析科学数据。代码的主要功能如下：

导入了一些必要的模块，如Vue, Vuex, Vuetify, GirderProvider, vtkURLExtract, vtkProxyManager等。
导出了一个ReaderFactory对象，它提供了一些方法来读取和导入不同格式的数据集。
定义了一个setActiveProxyConfiguration函数，它可以设置代理配置，用于控制Web应用程序中的可视化组件。
定义了一个createViewer函数，它可以创建一个Vue实例，并将其挂载到指定的容器元素上。这个函数接受一个代理配置作为参数，并返回一个对象，包含了一些属性和方法，如proxyManager, store, processURLArgs, addDatasetPanel, showApp, getSetting, setSetting等。
定义了一些逻辑来支持历史记录导航，设置同步，以及处理URL参数。
 */

// Expose IO API to Glance global object
export const {
  getReader,
  importBase64Dataset,
  listReaders,
  listSupportedExtensions,
  loadFiles,
  openFiles,
  registerReader,
  registerReadersToProxyManager,
} = ReaderFactory;

Vue.use(Vuex);
Vue.use(Vuetify);
Vue.use(ProxyManagerVuePlugin);

let activeProxyConfig = null;
/**
 * Sets the active proxy configuration to be used by createViewer.
 *
 * Once createViewer() is called, setActiveProxyConfiguration will do nothing.
 * Proxy config precedence (decreasing order):
 *   createViewer param, active proxy config, Generic config
 */
export function setActiveProxyConfiguration(config) {
  activeProxyConfig = config;
}

export function createViewer(container, proxyConfig = null) {
  const proxyConfiguration = proxyConfig || activeProxyConfig || Config.Proxy;
  const proxyManager = vtkProxyManager.newInstance({ proxyConfiguration });
  const settings = new Settings();

  const store = createStore({
    proxyManager,
    girder: GirderProvider,
  });

  const app = new Vue({
    el: container,
    components: { App },
    store,
    provide: GirderProvider,
    // if in the future we want to configure vuetify ourselves, see
    // https://github.com/girder/girder_web_components/blob/master/README.md
    vuetify: girderVuetify,
    proxyManager,
    template: '<App />',
  });

  // support history-based navigation
  function onRoute(event) {
    const state = event.state || {};
    if (state.app) {
      store.commit('showApp');
    } else {
      store.commit('showLanding');
    }
  }

  store.watch(
    (state) => state.route,
    (route) => {
      if (settings.get('noHistory')) {
        return;
      }
      const state = window.history.state || {};
      if (route === 'landing' && state.app) {
        window.history.back();
      }
      if (route === 'app' && !state.app) {
        window.history.pushState({ app: true }, '');
      }
    }
  );

  window.history.replaceState({ app: false }, '');
  window.addEventListener('popstate', onRoute);

  // always enable history setting. Users must explicitly disable it.
  settings.set('noHistory', false);

  settings.syncWithStore(store, {
    collapseDatasetPanels: {
      set: (val) => store.dispatch('collapseDatasetPanels', val),
      get: (state) => state.collapseDatasetPanels,
    },
    suppressBrowserWarning: {
      set: (val) => store.dispatch('suppressBrowserWarning', val),
      get: (state) => state.suppressBrowserWarning,
    },
  });

  return {
    proxyManager,
    store,

    processURLArgs() {
      const params = vtkURLExtract.extractURLParameters();

      Object.keys(params)
        .filter((key) => key.startsWith('setting.'))
        .forEach((key) => {
          const name = key.substr('setting.'.length);
          settings.set(name, params[key]);
        });

      const { name, url } = params;
      if (name && url) {
        const names = typeof name === 'string' ? [name] : name;
        const urls = typeof url === 'string' ? [url] : url;
        app.$children[0].autoLoadRemotes('resources from url', urls, names);
      }
    },
    // All components must have a unique name
    addDatasetPanel(component) {
      store.commit('addPanel', { component });
    },
    showApp() {
      store.commit('showApp');
    },
    getSetting(name) {
      return settings.get(name);
    },
    setSetting(name, value) {
      return settings.set(name, value);
    },
  };
}
