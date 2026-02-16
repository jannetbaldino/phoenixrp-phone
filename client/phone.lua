local isOpen = false

-- phone prop/anim state
local phoneProp = nil
local phoneAnimActive = false

local PHONE_MODEL = `prop_npc_phone_02`
local HAND_BONE = 28422

-- (keep your current offsets; change if you want)
local PHONE_OFFSETS = {
  -- push outward (Y) so it sits in the fingers instead of inside the palm
  pos = vec3(-0.010, -0.014, 0.005),

  -- slight tilt + twist so the screen faces the player and lines up with the grip
  rot = vec3(-15.0, 170.0, 20.0)
}

-- Animation tuning (slower)
local ANIM_DICT = "cellphone@"
local ANIM_IN = "cellphone_text_in"
local ANIM_IDLE = "cellphone_text_read_base"
local ANIM_OUT = "cellphone_text_out"

local ANIM_SPEED = 3.0
local ANIM_SPEED_MULT = -3.0
local ANIM_IN_WAIT = 650
local ANIM_OUT_WAIT = 600

local function loadModel(model)
  if type(model) == "string" then model = joaat(model) end
  if not IsModelInCdimage(model) then return false end
  RequestModel(model)
  local tries = 0
  while not HasModelLoaded(model) and tries < 100 do
    Wait(10)
    tries += 1
  end
  return HasModelLoaded(model)
end

local function loadAnimDict(dict)
  RequestAnimDict(dict)
  local tries = 0
  while not HasAnimDictLoaded(dict) and tries < 100 do
    Wait(10)
    tries += 1
  end
  return HasAnimDictLoaded(dict)
end

local function deletePhoneProp()
  if phoneProp and DoesEntityExist(phoneProp) then
    DeleteEntity(phoneProp)
  end
  phoneProp = nil
end

local function ensurePhoneProp(ped)
  if phoneProp and DoesEntityExist(phoneProp) then return end
  if not loadModel(PHONE_MODEL) then return end

  local coords = GetEntityCoords(ped)
  phoneProp = CreateObject(PHONE_MODEL, coords.x, coords.y, coords.z + 0.2, true, true, false)
  SetEntityCollision(phoneProp, false, false)
  SetEntityCompletelyDisableCollision(phoneProp, false, false)
  SetEntityAsMissionEntity(phoneProp, true, true)

  AttachEntityToEntity(
    phoneProp,
    ped,
    GetPedBoneIndex(ped, HAND_BONE),
    PHONE_OFFSETS.pos.x, PHONE_OFFSETS.pos.y, PHONE_OFFSETS.pos.z,
    PHONE_OFFSETS.rot.x, PHONE_OFFSETS.rot.y, PHONE_OFFSETS.rot.z,
    true, true, false, true, 1, true
  )
end

-- ------------------------------------------------------------
-- phone anim + prop (disabled in vehicles)
-- ------------------------------------------------------------
local function startPhoneAnim()
  local ped = PlayerPedId()
  if not DoesEntityExist(ped) or IsEntityDead(ped) then return end

  if IsPedInAnyVehicle(ped, false) then
    phoneAnimActive = false
    deletePhoneProp()
    ClearPedSecondaryTask(ped)
    return
  end

  if phoneAnimActive then return end
  if not loadAnimDict(ANIM_DICT) then return end

  ensurePhoneProp(ped)

  TaskPlayAnim(ped, ANIM_DICT, ANIM_IN, ANIM_SPEED, ANIM_SPEED_MULT, 1200, 50, 0.0, false, false, false)
  Wait(ANIM_IN_WAIT)

  TaskPlayAnim(ped, ANIM_DICT, ANIM_IDLE, ANIM_SPEED, ANIM_SPEED_MULT, -1, 49, 0.0, false, false, false)
  phoneAnimActive = true
end

local function stopPhoneAnim()
  local ped = PlayerPedId()

  if not phoneAnimActive then
    deletePhoneProp()
    if DoesEntityExist(ped) then ClearPedSecondaryTask(ped) end
    return
  end

  if DoesEntityExist(ped) and not IsEntityDead(ped) then
    if not IsPedInAnyVehicle(ped, false) then
      if loadAnimDict(ANIM_DICT) then
        TaskPlayAnim(ped, ANIM_DICT, ANIM_OUT, ANIM_SPEED, ANIM_SPEED_MULT, 1100, 50, 0.0, false, false, false)
        Wait(ANIM_OUT_WAIT)
      end
    end
    ClearPedSecondaryTask(ped)
  end

  deletePhoneProp()
  phoneAnimActive = false
end

-- ------------------------------------------------------------
-- UI bridge
-- ------------------------------------------------------------
local function sendUI(action, data)
  SendNUIMessage({ action = action, data = data })
end

local function fetchBootstrap()
  local ok, bootstrap = pcall(function()
    return lib.callback.await('prp-device:getBootstrap', false)
  end)

  if ok and bootstrap and bootstrap.user then
    return bootstrap
  end

  return {
    user = {
      phone_number = 'Unknown',
      citizenid = 'Unknown',
      server_id = GetPlayerServerId(PlayerId()),
      settings = { ringtone = 'default', text_tone = 'default' },
    },
    config = { ringtones = {}, text_tones = {} },
    conversations = {},
    unread_notifications = {},
  }
end

-- ------------------------------------------------------------
-- Control blocking while open
-- ------------------------------------------------------------
local function startControlBlockThread()
  CreateThread(function()
    while isOpen do
      DisableControlAction(0, 24, true)
      DisableControlAction(0, 25, true)
      DisableControlAction(0, 69, true)
      DisableControlAction(0, 70, true)
      DisableControlAction(0, 92, true)
      DisableControlAction(0, 140, true)
      DisableControlAction(0, 141, true)
      DisableControlAction(0, 142, true)
      DisableControlAction(0, 143, true)
      DisableControlAction(0, 37, true)
      DisableControlAction(0, 45, true)
      DisablePlayerFiring(PlayerId(), true)

      local ped = PlayerPedId()
      if DoesEntityExist(ped) and IsPedInAnyVehicle(ped, false) then
        phoneAnimActive = false
        deletePhoneProp()
        ClearPedSecondaryTask(ped)
      end

      Wait(0)
    end
  end)
end

-- ------------------------------------------------------------
-- open/close
-- ------------------------------------------------------------
local function openPhone()
  if isOpen then return end
  isOpen = true

  startPhoneAnim()
  startControlBlockThread()

  SetNuiFocus(true, true)
  SetNuiFocusKeepInput(false)

  local bootstrap = fetchBootstrap()
  sendUI('open', bootstrap)
end

local function closePhone()
  if not isOpen then
    sendUI('close')
    return
  end

  isOpen = false
  SetNuiFocus(false, false)
  SetNuiFocusKeepInput(false)

  sendUI('close')
  stopPhoneAnim()
end

RegisterCommand('phone', function()
  if isOpen then closePhone() else openPhone() end
end, false)

RegisterKeyMapping('phone', 'Open Phone', 'keyboard', 'F1')

-- ------------------------------------------------------------
-- NUI callbacks
-- ------------------------------------------------------------
RegisterNUICallback('close', function(_, cb)
  closePhone()
  cb(true)
end)

RegisterNUICallback('sendMessage', function(data, cb)
  local peer = data and data.peer_number
  local body = data and data.body

  local ok, resp = pcall(function()
    return lib.callback.await('prp-device:sendMessage', false, peer, body)
  end)

  if not ok then cb({ ok = false }) return end
  cb(resp or { ok = false })
end)

RegisterNUICallback('markNotifRead', function(data, cb)
  if data and data.id then
    TriggerServerEvent('prp-device:notifications:markRead', data.id)
  end
  cb(true)
end)

RegisterNUICallback('saveSettings', function(data, cb)
  local ok, resp = pcall(function()
    return lib.callback.await('prp-device:settings:save', false, data)
  end)
  if not ok then cb({ ok = false }) return end
  cb(resp or { ok = false })
end)

-- Wallet
RegisterNUICallback('walletGetAccounts', function(_, cb)
  local ok, resp = pcall(function()
    return lib.callback.await('prp-device:wallet:getAccounts', false)
  end)
  if not ok then cb({ ok = false }) return end
  cb(resp or { ok = false })
end)

RegisterNUICallback('walletHistory', function(_, cb)
  local ok, resp = pcall(function()
    return lib.callback.await('prp-device:wallet:history', false)
  end)
  if not ok then cb({ ok = false }) return end
  cb(resp or { ok = false })
end)

RegisterNUICallback('walletTransfer', function(data, cb)
  local ok, resp = pcall(function()
    return lib.callback.await('prp-device:wallet:transfer', false, data)
  end)
  if not ok then cb({ ok = false }) return end
  cb(resp or { ok = false })
end)

-- ✅ Calls (THIS is what you were missing)
RegisterNUICallback('callDial', function(data, cb)
  local number = data and (data.number or data.to_number or data.toNumber)
  local ok, resp = pcall(function()
    return lib.callback.await('prp-device:callDial', false, number)
  end)
  if not ok then cb({ ok = false, error = 'callback_failed' }) return end
  cb(resp or { ok = false })
end)

RegisterNUICallback('callAccept', function(data, cb)
  local callId = data and (data.call_id or data.callId)
  local ok, resp = pcall(function()
    return lib.callback.await('prp-device:callAccept', false, callId)
  end)
  if not ok then cb({ ok = false, error = 'callback_failed' }) return end
  cb(resp or { ok = false })
end)

RegisterNUICallback('callDecline', function(data, cb)
  local callId = data and (data.call_id or data.callId)
  local ok, resp = pcall(function()
    return lib.callback.await('prp-device:callDecline', false, callId)
  end)
  if not ok then cb({ ok = false, error = 'callback_failed' }) return end
  cb(resp or { ok = false })
end)

RegisterNUICallback('callHangup', function(data, cb)
  local callId = data and (data.call_id or data.callId)
  local ok, resp = pcall(function()
    return lib.callback.await('prp-device:callHangup', false, callId)
  end)
  if not ok then cb({ ok = false, error = 'callback_failed' }) return end
  cb(resp or { ok = false })
end)

-- ------------------------------------------------------------
-- Server -> UI events for calls
-- ------------------------------------------------------------
RegisterNetEvent('prp-device:call:incoming', function(payload)
  if not isOpen then return end
  sendUI('callIncoming', payload)
end)

RegisterNetEvent('prp-device:call:outgoing', function(payload)
  if not isOpen then return end
  sendUI('callOutgoing', payload)
end)

RegisterNetEvent('prp-device:call:active', function(payload)
  if not isOpen then return end
  sendUI('callActive', payload)
end)

RegisterNetEvent('prp-device:call:ended', function(payload)
  if not isOpen then return end
  sendUI('callEnded', payload)
end)

-- notifications/messages passthrough
RegisterNetEvent('prp-device:notify', function(payload)
  if not isOpen then return end
  sendUI('notify', payload)
end)

RegisterNetEvent('prp-device:message:new', function(msg)
  if not isOpen then return end
  sendUI('messageNew', msg)
end)

-- Cleanup
AddEventHandler('onClientResourceStart', function(res)
  if res ~= GetCurrentResourceName() then return end
  isOpen = false
  SetNuiFocus(false, false)
  SetNuiFocusKeepInput(false)
  sendUI('close')
  stopPhoneAnim()
end)

AddEventHandler('onResourceStop', function(res)
  if res ~= GetCurrentResourceName() then return end
  isOpen = false
  SetNuiFocus(false, false)
  SetNuiFocusKeepInput(false)
  sendUI('close')
  stopPhoneAnim()
end)
