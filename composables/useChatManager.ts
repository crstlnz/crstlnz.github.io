import { Peer } from 'peerjs'
import { v4 as uuid } from 'uuid'
import { useChatUser } from '~/store/chatUser'

export default function () {
  const route = useRoute()
  const router = useRouter()
  const roomId = ref()
  const pending = ref(true)
  const chatUser = useChatUser()
  const connectionAttempts = new Set()
  const { id, name, avatarId } = storeToRefs(chatUser)

  // const tempRoomIds = useLocalStorage<Set<string>>('temp-room-ids', () => new Set())

  interface Creds {
    urls: string[]
    username: string
    credential: string
  }
  const { data } = useAsyncData<Creds[]>('turn-key', async () => {
    const cloudflareCreds = await $fetch<Creds>(`https://api.crstlnz.my.id/api/turn`)
    return [
      cloudflareCreds,
    ]
  })
  const connections = ref<Map<string, Chat.CustomDataConnection>>(new Map())
  const error = ref()
  const isHost = ref(true)
  let peer: Peer

  const dayjs = useDayjs()
  const messages = ref<Chat.TypedMessage[]>([])
  function addMessage(chat: Chat.TypedMessage) {
    const last = messages.value?.[(messages.value?.length || 1) - 1]
    if (last && last.type === chat.type) {
      if (chat.type === 'info') {
        if (dayjs(chat.date).diff(dayjs(last.date), 'minute') < 1) {
          last.messages.push(...chat.messages as any)
          return
        }
      }
      else {
        if (chat.userId === last.userId) {
          if (dayjs(chat.date).diff(dayjs(last.date), 'minute') < 1) {
            last.messages.push(...chat.messages as any)
            return
          }
        }
      }
    }
    messages.value.push(chat)
  }

  function clearNoActivityTimeout(c: Chat.CustomDataConnection) {
    if (c.timeout) clearTimeout(c.timeout)
  }

  function refreshTimeout(c: Chat.CustomDataConnection) {
    clearNoActivityTimeout(c)
    c.timeout = setTimeout(() => {
      pingTimeout(c)
    }, 5000)
  }

  function clearPingTimeout(c: Chat.CustomDataConnection) {
    if (c.pingTimeout) clearTimeout(c.pingTimeout)
  }

  function pingTimeout(c: Chat.CustomDataConnection) {
    clearPingTimeout(c)
    c.send('PING')
    c.pingTimeout = setTimeout(() => {
      c.close()
    }, 3000)
  }

  function listenConnection(connection: Chat.CustomDataConnection) {
    connection.removeAllListeners()
    if ([...connections.value.values()].some(i => i.data?.id === connection.data?.id)) {
      connection.close()
      return
    }
    refreshTimeout(connection)
    connection.removeAllListeners()
    connection.on('open', () => {
      connectionAttempts.delete(connection.peer)
      // tempRoomIds.value.add(connection.peer)
      connections.value.set(connection.peer, connection)
      router.replace({
        query: {
          room: connection.peer,
        },
      })
      connection.send({
        type: 'metadata',
        data: {
          id: id.value,
          name: name.value,
          avatarId: avatarId.value,
        },
      })

      const connectionData = [...connections.value.values()].filter(i => i.peer !== peer.id).map(i => i.peer)
      for (const c of connections.value.values()) {
        const filtered = connectionData.filter(i => i !== c.peer)
        if (filtered.length) {
          c.send({
            type: 'connections',
            data: filtered,
          })
        }
      }
    })

    connection.on('data', (data: any) => {
      refreshTimeout(connection)
      if (data === 'PING') {
        connection.send('PONG')
      }
      else if (data === 'PONG') {
        clearPingTimeout(connection)
      }
      else
        if (data.type === 'chat') {
          addMessage({
            ...data.data,
            id: uuid(),
            type: 'in',
          })
        }
        else if (data.type === 'metadata') {
          addMessage({
            avatarId: data.data?.avatarId || '',
            userId: id.value,
            name: data.data?.name || '',
            messages: [
            `${data.data.name} joined the room.`,
            ],
            date: new Date().toISOString(),
            type: 'info',
            id: uuid(),
          })
          connection.data = data.data
          triggerRef(connections)
        }
        else if (data.type === 'connections') {
          for (const room of data.data) {
            if (!connections.value.has(room) && !connectionAttempts.has(room)) {
              joinRoom(room)
            }
          }
        }
    })

    connection.on('error', (e) => {
      console.error(e)
      connectionAttempts.delete(connection.peer)
      clearNoActivityTimeout(connection)
      // tempRoomIds.value.delete(connection.peer)
      connections.value.delete(connection.peer)
    })

    connection.on('close', () => {
      console.error('CLOSED', connection.peer)
      connectionAttempts.delete(connection.peer)
      clearNoActivityTimeout(connection)
      addMessage({
        avatarId: connection.data?.avatarId || '',
        userId: id.value,
        name: connection.data?.name || '',
        messages: [
          `${connection.data?.name} leave the room.`,
        ],
        date: new Date().toISOString(),
        type: 'info',
        id: uuid(),
      })
      // tempRoomIds.value.delete(connection.peer)
      connections.value.delete(connection.peer)
    })
  }

  function connect(room?: string) {
    error.value = null

    destroy()
    peer = new Peer({
      config: {
        iceServers: data.value
          ? [
              ...data.value,
            ]
          : undefined,
      },
    })

    peer.on('open', (id: any) => {
      pending.value = false
      roomId.value = id
      if (room) {
        joinRoom(room)
      }
      // if (tempRoomIds.value.size) {
      //   for (const id of tempRoomIds.value.values()) {
      //     if (room !== id) {
      //       joinRoom(id)
      //     }
      //   }
      // }
    })

    peer.on('disconnected', () => {
      pending.value = true
    })

    peer.on('error', (e: any) => {
      console.error(e)
      if (peer.disconnected) {
        pending.value = true
        roomId.value = null
      }
      error.value = e.message
    })

    peer.on('connection', (connection) => {
      const conn: Chat.CustomDataConnection = connection as Chat.CustomDataConnection
      conn.data = connection.metadata
      if (!connections.value.has(connection.peer) && !connectionAttempts.has(connection.peer)) {
        listenConnection(connection)
      }
    })
  }

  function destroy() {
    if (peer) {
      try {
        peer.removeAllListeners()
        peer.disconnect()
        peer.destroy()
      }
      catch (e) {
        console.log(e)
      }
    }
  }

  function joinRoom(room?: string) {
    console.log('Joining', room)
    if (!peer.disconnected) {
      isHost.value = false
      const id = room || ''
      const connection = peer.connect(id)
      connectionAttempts.add(id)
      listenConnection(connection)
    }
  }

  const chatInput = ref('')

  function sendChat(message: string | Chat.ImageMessage) {
    // const chatData = {
    //   id: uuid(),
    //   name: name.value || 'No name',
    //   message,
    // }

    // chat.value.push(chatData)
    const chatData: Chat.ChatMessage = {
      avatarId: avatarId.value,
      userId: id.value,
      name: name.value,
      messages: [message],
      date: new Date().toISOString(),
    }

    addMessage({
      ...chatData,
      id: uuid(),
      type: 'out',
    })

    for (const conn of connections.value.values()) {
      conn.send({
        type: 'chat',
        data: chatData,
      })
    }

    chatInput.value = ''
  }

  watch(data, (v) => {
    if (v) {
      connect(route.query.room ? String(route.query.room) : undefined)
    }
  })

  return { connections, roomId, sendChat, messages, pending }
}
