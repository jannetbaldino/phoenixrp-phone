fx_version 'cerulean'
game 'gta5'

lua54 'yes'

description 'PRP Phone (NUI)'
version '0.0.3'

-- React/Vite build output
ui_page 'ui/dist/index.html'

files {
  'ui/dist/index.html',
  'ui/dist/assets/**'
}

shared_scripts {
  '@ox_lib/init.lua',
  '@phoenix-device-core/shared/config.lua'
}

client_scripts {
  'client/phone.lua'
}

dependencies {
  'ox_lib',
  'phoenix-device-core'
}
