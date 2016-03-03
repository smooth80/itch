
import test from 'zopf'
import proxyquire from 'proxyquire'

import AppConstants from '../../app/constants/app-constants'

import AppDispatcher from '../stubs/app-dispatcher'
import electron from '../stubs/electron'

test('TrayStore', t => {
  const os = test.module({
    platform: () => 'darwin'
  })

  const stubs = Object.assign({
    '../util/os': os,
    '../dispatcher/app-dispatcher': AppDispatcher
  }, electron)

  const TrayStore = proxyquire('../../app/stores/tray-store', stubs).default
  const handler = AppDispatcher.get_handler('tray-store')

  t.case('darwin', t => {
    t.stub(os, 'platform').returns('darwin')
    handler({ action_type: AppConstants.BOOT })
  })

  t.case('non-darwin', t => {
    t.stub(os, 'platform').returns('win32')
    handler({ action_type: AppConstants.BOOT })
    let has_tray = false
    TrayStore.with((t) => has_tray = true)
    t.ok(has_tray)
  })
})
