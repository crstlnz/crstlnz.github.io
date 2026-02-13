import type { ChatMessageIn } from '#build/components';
<script lang="ts" setup>
import { useEventListener, useLocalStorage } from '@vueuse/core'
import multiavatar from '@multiavatar/multiavatar/esm'
import { useNotifications } from '~/store/notifications'
import { useChatUser } from '~/store/chatUser'

const { connections, roomId, messages, sendChat, pending } = useChatManager()

const chatUser = useChatUser()
const { id, name, avatarId } = storeToRefs(chatUser)
const avatar = computed(() => {
  return multiavatar(avatarId.value)
})

const title = 'P2P Chat'
const openMenu = ref(false)
const route = useRoute()

watch(() => route.path, () => {
  openMenu.value = false
})

function open() {
  window.history.pushState({ isOpen: true }, 'Menu Nav')
  openMenu.value = true
}

function close() {
  window.history.back()
  openMenu.value = false
}

onMounted(() => {
  useEventListener(window, 'popstate', (event) => {
    openMenu.value = !!event.state?.isPopup
  })
})

const roomName = ref('The Lounge')
const { copy, isSupported } = useClipboard({ legacy: true })

const { addNotif } = useNotifications()
const notifCooldown = ref(false)
const copied = ref(false)
function copyLink() {
  if (isSupported.value) {
    copy(`${window.location.origin + window.location.pathname}?room=${roomId.value}`)
    if (!copied.value) {
      copied.value = true
      setTimeout(() => {
        copied.value = false
      }, 2000)
    }
    if (!notifCooldown.value) {
      addNotif({
        message: 'Share this link to join this room!',
        type: 'success',
        duration: 2000,
      })
      notifCooldown.value = true
      setTimeout(() => {
        notifCooldown.value = false
      }, 2000)
    }
  }
}

function onBeforeLeave(el: Element) {
  const rect = el.getBoundingClientRect()
  const element = el as HTMLElement
  element.style.top = `${rect.top}px`
  element.style.left = `${rect.left}px`
  element.style.height = `${rect.height}px`
  element.style.width = `${rect.width}px`
}

const infoOpen = ref(false)
</script>

<template>
  <div id="chat-room" class="flex w-full h-[100dvh] relative">
    <Transition name="fade">
      <div v-if="pending" class="fixed bg-black/50 flex inset-0 items-center justify-center font-bold text-4xl ">
        <div class="animate-pulse">
          Connecting...
        </div>
      </div>
    </Transition>
    <div class="md:hidden w-full h-full bg-black/50 fixed inset-0 z-10 transition-all duration-500" :class="{ 'pointer-events-none opacity-0 invisible': !openMenu, 'pointer-events-auto visible': openMenu }" @click="close" />
    <div class="border-r-2 border-white/5 max-md:w-[65vw] lg:w-[220px] xl:w-[280px] flex flex-col h-full max-md:fixed bg-navy-1 max-md:z-10 transition-all duration-300" :class="{ 'max-md:-translate-x-full': !openMenu }">
      <div class="flex gap-1.5 items-center pt-3 max-md:px-3 md:px-3 md:pb-3" :title="title">
        <NuxtLink to="/" class="flex gap-1.5 items-center">
          <div class="rounded-full w-7 h-7 shrink-0">
            <Icon name="ph:chat-teardrop-dots-fill" class="w-full h-full" />
          </div>
          <span class="max-md:flex max-md:pt-1 pt-0.5 text-2xl font-bold font-modern">{{ title }}</span>
        </NuxtLink>
        <button type="button" class="w-5 h-5" @click="infoOpen = true">
          <Icon name="mdi:information-variant-circle-outline" class="w-full h-full opacity-50 hover:opacity-100" />
        </button>
      </div>
      <HeadlessTransitionRoot appear :show="infoOpen" as="template">
        <HeadlessDialog as="div" class="relative z-10" @close="infoOpen = false">
          <HeadlessTransitionChild
            as="template"
            enter="duration-300 ease-out"
            enter-from="opacity-0"
            enter-to="opacity-100"
            leave="duration-200 ease-in"
            leave-from="opacity-100"
            leave-to="opacity-0"
          >
            <div class="fixed inset-0 bg-black/25" />
          </HeadlessTransitionChild>

          <div class="fixed inset-0 overflow-y-auto">
            <div
              class="flex min-h-full items-center justify-center p-4 text-center"
            >
              <HeadlessTransitionChild
                as="template"
                enter="duration-300 ease-out"
                enter-from="opacity-0 scale-95"
                enter-to="opacity-100 scale-100"
                leave="duration-200 ease-in"
                leave-from="opacity-100 scale-100"
                leave-to="opacity-0 scale-95"
              >
                <HeadlessDialogPanel
                  class="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all"
                >
                  <HeadlessDialogTitle
                    as="h3"
                    class="text-lg font-medium leading-6 text-gray-900"
                  >
                    Peer to Peer Chat
                  </HeadlessDialogTitle>
                  <div class="mt-2">
                    <p class="text-sm text-gray-500">
                      Peer-to-peer (P2P) chat is a direct communication model where users exchange messages directly between their devices without relying on a central server, facilitating real-time and decentralized conversations.
                    </p>
                  </div>

                  <div class="mt-4">
                    <button
                      type="button"
                      class="inline-flex justify-center rounded-md border border-transparent bg-blue-100 px-4 py-2 text-sm font-medium text-blue-900 hover:bg-blue-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                      @click="infoOpen = false"
                    >
                      Got it, thanks!
                    </button>
                  </div>
                </HeadlessDialogPanel>
              </HeadlessTransitionChild>
            </div>
          </div>
        </HeadlessDialog>
      </HeadlessTransitionRoot>
      <div class="max-md:flex px-4 md:px-3 text-sm flex gap-1.5 items-center max-md:py-2">
        <div
          :class="{
            'bg-green-500': connections.size >= 1,
            'bg-gray-500': connections.size === 0,
          }" class="w-3 h-3  rounded-full"
        />
        <span>
          Connected User ({{ connections.size }})
        </span>
      </div>
      <div class="max-md:px-3 md:px-3 pt-3 flex-1 overflow-y-auto pb-3 flex flex-col gap-3 max-md:items-stretch">
        <TransitionGroup name="connecteduser" @before-leave="onBeforeLeave">
          <ChatConnectedUser v-for="connection in connections.values()" :key="connection.connectionId" :name="connection.data?.name || ''" :avatar-id="connection.data?.avatarId || ''" />
        </TransitionGroup>
      </div>
      <div class="shrink-0 flex gap-3 items-center max-md:px-3 max-lg:px-2 max-md:justify-start md:px-4 py-2 border-t-2 border-white/5">
        <div class="w-10 h-10 rounded-full overflow-hidden" v-html="avatar" />
        <div class="max-md:block flex-1 truncate">
          {{ name }}
        </div>
      </div>
    </div>
    <!-- CONTENT -->
    <div class="flex flex-col flex-1 h-full">
      <!-- APPBAR -->
      <div class="flex max-md:gap-3 px-3 md:px-4 py-3 border-b-2 border-white/5">
        <button type="button" class="sm:hidden w-8 h-8 rounded-md" @click="open">
          <Icon name="ph:list" class="w-full h-full p-1" />
        </button>
        <span class="font-semibold flex-1 text-2xl">{{ roomName }}</span>
        <button
          v-if="isSupported && roomId"
          type="button"
          aria-label="Copy Link"
          target="_blank"
          to="https://github.com/crstlnz"
          class="rounded-full"
          @click="copyLink"
        >
          <div class="relative bg-white flex p-1.5 h-7 w-7 rounded-full items-center justify-center">
            <Icon name="ph:link-simple" class="mb-[1px] h-5 w-5 -translate-x-1/2 left-1/2 top-1/2 -translate-y-1/2 text-slate-700 absolute inset-1" :class="{ invisible: copied }" />
            <Icon name="ic:baseline-check" class="mb-[1px] h-5 w-5 -translate-x-1/2 left-1/2 top-1/2 -translate-y-1/2 text-slate-700 absolute inset-1" :class="{ invisible: !copied }" />
          </div>
        </button>
      </div>
      <!-- MESSAGE CONTENT & CHAT INPUT -->
      <Transition name="fade" mode="out-in">
        <div v-if="connections.size > 0 || messages.length" class="flex-1 min-h-0 flex flex-col">
          <ChatMessageContainer :messages="messages" class="flex-1" />
          <ChatInput class="max-md:pb-2" @send="sendChat" />
        </div>
        <div v-else class="flex flex-1 justify-center items-center">
          <button
            v-if="isSupported && roomId"
            type="button"
            aria-label="Copy Link"
            target="_blank"
            class="rounded-full"
            @click="copyLink"
          >
            <div v-if="roomId" class="flex gap-3 items-center">
              <div class="text-xl text-center">
                Share your room
              </div>
              <div class="relative bg-white flex p-1.5 h-7 w-7 rounded-full items-center justify-center">
                <Icon name="ph:link-simple" class="mb-[1px] h-5 w-5 -translate-x-1/2 left-1/2 top-1/2 -translate-y-1/2 text-slate-700 absolute inset-1" :class="{ invisible: copied }" />
                <Icon name="ic:baseline-check" class="mb-[1px] h-5 w-5 -translate-x-1/2 left-1/2 top-1/2 -translate-y-1/2 text-slate-700 absolute inset-1" :class="{ invisible: !copied }" />
              </div>
            </div>
          </button>
        </div>
      </Transition>
    </div>
  </div>
</template>
