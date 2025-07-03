import {
  ClearOutlined,
  DeleteOutlined,
  EditOutlined,
  FolderOutlined,
  PushpinOutlined,
  UploadOutlined
} from '@ant-design/icons'
import DragableList from '@renderer/components/DragableList'
import CopyIcon from '@renderer/components/Icons/CopyIcon'
import PromptPopup from '@renderer/components/Popups/PromptPopup'
import Scrollbar from '@renderer/components/Scrollbar'
import { useAssistants } from '@renderer/hooks/useAssistant'
import { modelGenerating } from '@renderer/hooks/useRuntime'
import { useSettings } from '@renderer/hooks/useSettings'
import { finishTopicRenaming, startTopicRenaming, TopicManager, useAllTopics } from '@renderer/hooks/useTopic'
import { fetchMessagesSummary } from '@renderer/services/ApiService'
import { EVENT_NAMES, EventEmitter } from '@renderer/services/EventService'
import store, { RootState, useAppDispatch } from '@renderer/store'
import { addTopic, removeTopic, updateTopic } from '@renderer/store/assistants'
import { setGenerating } from '@renderer/store/runtime'
import { Assistant, Topic } from '@renderer/types'
import { copyTopicAsMarkdown, copyTopicAsPlainText } from '@renderer/utils/copy'
import { exportTopicAsMarkdown, exportTopicToNotion } from '@renderer/utils/export'
import { hasTopicPendingRequests } from '@renderer/utils/queue'
import { Dropdown, MenuProps } from 'antd'
import { ItemType, MenuItemType } from 'antd/es/menu/interface'
import { findIndex } from 'lodash'
import { FC, startTransition, useCallback, useDeferredValue, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import styled from 'styled-components'

import TopicItem from './components/TopicItem'

interface Props {
  activeTopic: Topic
  setActiveTopic: (topic: Topic) => void
  setActiveAssistant: (assistant: Assistant) => void
}

const AllTopics: FC<Props> = ({ activeTopic, setActiveTopic, setActiveAssistant }) => {
  const { assistants } = useAssistants()
  const dispatch = useAppDispatch()
  const { t } = useTranslation()
  const { showTopicTime } = useSettings()

  const renamingTopics = useSelector((state: RootState) => state.runtime.chat.renamingTopics)
  const newlyRenamedTopics = useSelector((state: RootState) => state.runtime.chat.newlyRenamedTopics)

  const borderRadius = showTopicTime ? 12 : 'var(--list-item-border-radius)'

  const [deletingTopicId, setDeletingTopicId] = useState<string | null>(null)
  const deleteTimerRef = useRef<NodeJS.Timeout>(null)

  const pendingTopics = useMemo(() => {
    return new Set<string>()
  }, [])

  // 使用新的useAllTopics hook获取所有话题
  const allTopics = useAllTopics()

  const isPending = useCallback(
    (topicId: string) => {
      const hasPending = hasTopicPendingRequests(topicId)
      if (topicId === activeTopic.id && !hasPending) {
        pendingTopics.delete(topicId)
        return false
      }
      if (pendingTopics.has(topicId)) {
        return true
      }
      if (hasPending) {
        pendingTopics.add(topicId)
        return true
      }
      return false
    },
    [activeTopic.id, pendingTopics]
  )

  const isRenaming = useCallback(
    (topicId: string) => {
      return renamingTopics.includes(topicId)
    },
    [renamingTopics]
  )

  const isNewlyRenamed = useCallback(
    (topicId: string) => {
      return newlyRenamedTopics.includes(topicId)
    },
    [newlyRenamedTopics]
  )

  const handleDeleteClick = useCallback((topicId: string, e: React.MouseEvent) => {
    e.stopPropagation()

    if (deleteTimerRef.current) {
      clearTimeout(deleteTimerRef.current)
    }

    setDeletingTopicId(topicId)

    deleteTimerRef.current = setTimeout(() => setDeletingTopicId(null), 2000)
  }, [])

  const onClearMessages = useCallback((topic: Topic) => {
    store.dispatch(setGenerating(false))
    EventEmitter.emit(EVENT_NAMES.CLEAR_MESSAGES, topic)
  }, [])

  const handleConfirmDelete = useCallback(
    async (topic: Topic, e: React.MouseEvent) => {
      e.stopPropagation()
      const assistant = assistants.find((a) => a.id === topic.assistantId)
      if (!assistant) return

      if (assistant.topics.length === 1) {
        return onClearMessages(topic)
      }
      await modelGenerating()
      const index = findIndex(assistant.topics, (t) => t.id === topic.id)
      if (topic.id === activeTopic.id) {
        setActiveTopic(assistant.topics[index + 1 === assistant.topics.length ? index - 1 : index + 1])
      }
      dispatch(removeTopic({ assistantId: assistant.id, topic }))
      setDeletingTopicId(null)
    },
    [activeTopic.id, assistants, onClearMessages, setActiveTopic, dispatch]
  )

  const onPinTopic = useCallback(
    (topic: Topic) => {
      const assistant = assistants.find((a) => a.id === topic.assistantId)
      if (!assistant) return

      const updatedTopic = { ...topic, pinned: !topic.pinned }
      dispatch(updateTopic({ assistantId: assistant.id, topic: updatedTopic }))
    },
    [assistants, dispatch]
  )

  const onDeleteTopic = useCallback(
    async (topic: Topic) => {
      const assistant = assistants.find((a) => a.id === topic.assistantId)
      if (!assistant) return

      await modelGenerating()
      if (topic.id === activeTopic?.id) {
        const index = findIndex(assistant.topics, (t) => t.id === topic.id)
        setActiveTopic(assistant.topics[index + 1 === assistant.topics.length ? index - 1 : index + 1])
      }
      dispatch(removeTopic({ assistantId: assistant.id, topic }))
    },
    [assistants, setActiveTopic, activeTopic, dispatch]
  )

  const onMoveTopic = useCallback(
    async (topic: Topic, toAssistant: Assistant) => {
      const fromAssistant = assistants.find((a) => a.id === topic.assistantId)
      if (!fromAssistant) return

      await modelGenerating()
      const index = findIndex(fromAssistant.topics, (t) => t.id === topic.id)
      setActiveTopic(fromAssistant.topics[index + 1 === fromAssistant.topics.length ? 0 : index + 1])

      const topicWithNewAssistantId = { ...topic, assistantId: toAssistant.id }
      dispatch(addTopic({ assistantId: toAssistant.id, topic: topicWithNewAssistantId }))
      dispatch(removeTopic({ assistantId: fromAssistant.id, topic }))
    },
    [assistants, setActiveTopic, dispatch]
  )

  const onSwitchTopic = useCallback(
    async (topic: Topic) => {
      startTransition(() => {
        setActiveTopic(topic)
        const assistant = assistants.find((a) => a.id === topic.assistantId)
        if (assistant) {
          setActiveAssistant(assistant)
        }
      })
    },
    [setActiveTopic, setActiveAssistant, assistants]
  )

  const exportMenuOptions = useSelector((state: RootState) => state.settings.exportMenuOptions)

  const [_targetTopic, setTargetTopic] = useState<Topic | null>(null)
  const targetTopic = useDeferredValue(_targetTopic)

  const getTopicMenuItems = useMemo(() => {
    const topic = targetTopic
    if (!topic) return []

    const assistant = assistants.find((a) => a.id === topic.assistantId)
    if (!assistant) return []

    const menus: MenuProps['items'] = [
      {
        label: t('chat.topics.auto_rename'),
        key: 'auto-rename',
        icon: <i className="iconfont icon-business-smart-assistant" style={{ fontSize: '14px' }} />,
        disabled: isRenaming(topic.id),
        async onClick() {
          const messages = await TopicManager.getTopicMessages(topic.id)
          if (messages.length >= 2) {
            startTopicRenaming(topic.id)
            try {
              const summaryText = await fetchMessagesSummary({ messages, assistant })
              if (summaryText) {
                const updatedTopic = { ...topic, name: summaryText, isNameManuallyEdited: false }
                dispatch(updateTopic({ assistantId: assistant.id, topic: updatedTopic }))
              } else {
                window.message?.error(t('message.error.fetchTopicName'))
              }
            } finally {
              finishTopicRenaming(topic.id)
            }
          }
        }
      },
      {
        label: t('chat.topics.edit.title'),
        key: 'rename',
        icon: <EditOutlined />,
        disabled: isRenaming(topic.id),
        async onClick() {
          const name = await PromptPopup.show({
            title: t('chat.topics.edit.title'),
            message: '',
            defaultValue: topic?.name || ''
          })
          if (name && topic?.name !== name) {
            const updatedTopic = { ...topic, name, isNameManuallyEdited: true }
            dispatch(updateTopic({ assistantId: assistant.id, topic: updatedTopic }))
          }
        }
      },
      {
        label: topic.pinned ? t('chat.topics.unpinned') : t('chat.topics.pinned'),
        key: 'pin',
        icon: <PushpinOutlined />,
        onClick() {
          onPinTopic(topic)
        }
      },
      {
        label: t('chat.topics.clear.title'),
        key: 'clear-messages',
        icon: <ClearOutlined />,
        async onClick() {
          window.modal.confirm({
            title: t('chat.input.clear.content'),
            centered: true,
            onOk: () => onClearMessages(topic)
          })
        }
      },
      {
        label: t('chat.topics.copy.title'),
        key: 'copy',
        icon: <CopyIcon />,
        children: [
          {
            label: t('chat.topics.copy.markdown'),
            key: 'copy-markdown',
            onClick: () => copyTopicAsMarkdown(topic)
          },
          {
            label: t('chat.topics.copy.plain'),
            key: 'copy-plain',
            onClick: () => copyTopicAsPlainText(topic)
          }
        ]
      },
      {
        label: t('chat.topics.export.title'),
        key: 'export',
        icon: <UploadOutlined />,
        children: [
          exportMenuOptions.image && {
            label: t('chat.topics.export.image'),
            key: 'image',
            onClick: () => EventEmitter.emit(EVENT_NAMES.EXPORT_TOPIC_IMAGE, topic)
          },
          exportMenuOptions.markdown && {
            label: t('chat.topics.export.md'),
            key: 'markdown',
            onClick: () => exportTopicAsMarkdown(topic)
          },
          exportMenuOptions.notion && {
            label: t('chat.topics.export.notion'),
            key: 'notion',
            onClick: async () => {
              exportTopicToNotion(topic)
            }
          }
        ].filter(Boolean) as ItemType<MenuItemType>[]
      }
    ]

    if (assistants.length > 1 && assistant.topics.length > 1) {
      menus.push({
        label: t('chat.topics.move_to'),
        key: 'move',
        icon: <FolderOutlined />,
        children: assistants
          .filter((a) => a.id !== assistant.id)
          .map((a) => ({
            label: a.name,
            key: a.id,
            onClick: () => onMoveTopic(topic, a)
          }))
      })
    }

    if (assistant.topics.length > 1 && !topic.pinned) {
      menus.push({ type: 'divider' })
      menus.push({
        label: t('common.delete'),
        danger: true,
        key: 'delete',
        icon: <DeleteOutlined />,
        onClick: () => onDeleteTopic(topic)
      })
    }

    return menus
  }, [
    targetTopic,
    t,
    isRenaming,
    exportMenuOptions,
    assistants,
    onPinTopic,
    onClearMessages,
    onMoveTopic,
    onDeleteTopic,
    dispatch
  ])

  return (
    <Container>
      <Dropdown menu={{ items: getTopicMenuItems }} trigger={['contextMenu']}>
        <Container className="all-topics-tab">
          <DragableList list={allTopics} onUpdate={() => {}}>
            {(topicWithAssistant) => {
              const topic = topicWithAssistant
              const isActive = topic.id === activeTopic?.id
              const isDeleting = deletingTopicId === topic.id

              return (
                <TopicItem
                  key={topic.id}
                  topic={topic}
                  isActive={isActive}
                  isPending={isPending(topic.id)}
                  isRenaming={isRenaming(topic.id)}
                  isNewlyRenamed={isNewlyRenamed(topic.id)}
                  isDeleting={isDeleting}
                  showTopicTime={showTopicTime}
                  showAssistantAvatar={true}
                  onSwitchTopic={onSwitchTopic}
                  onDeleteClick={handleDeleteClick}
                  onConfirmDelete={handleConfirmDelete}
                  onContextMenu={() => setTargetTopic(topic)}
                  borderRadius={borderRadius}
                />
              )
            }}
          </DragableList>
          <div style={{ minHeight: '10px' }}></div>
        </Container>
      </Dropdown>
    </Container>
  )
}

const Container = styled(Scrollbar)`
  display: flex;
  flex-direction: column;
  padding: 10px;
`

export default AllTopics
