import { CloseOutlined, DeleteOutlined, PushpinOutlined } from '@ant-design/icons'
import { isMac } from '@renderer/config/constant'
import { Assistant, Topic } from '@renderer/types'
import { Tooltip } from 'antd'
import dayjs from 'dayjs'
import { FC } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

interface TopicItemProps {
  topic: Topic & { assistant?: Assistant }
  isActive: boolean
  isPending: boolean
  isRenaming: boolean
  isNewlyRenamed: boolean
  isDeleting: boolean
  showTopicTime?: boolean
  showAssistantAvatar?: boolean
  onSwitchTopic: (topic: Topic) => void
  onDeleteClick: (topicId: string, e: React.MouseEvent) => void
  onConfirmDelete: (topic: Topic, e: React.MouseEvent) => void
  onContextMenu: () => void
  borderRadius?: string | number
}

const TopicItem: FC<TopicItemProps> = ({
  topic,
  isActive,
  isPending,
  isRenaming,
  isNewlyRenamed,
  isDeleting,
  showTopicTime = false,
  showAssistantAvatar = false,
  onSwitchTopic,
  onDeleteClick,
  onConfirmDelete,
  onContextMenu,
  borderRadius
}) => {
  const { t } = useTranslation()

  const topicName = topic.name.replace('`', '')
  const topicPrompt = topic.prompt
  const fullTopicPrompt = t('common.prompt') + ': ' + topicPrompt

  const getTopicNameClassName = () => {
    if (isRenaming) return 'shimmer'
    if (isNewlyRenamed) return 'typing'
    return ''
  }

  return (
    <TopicListItem
      onContextMenu={onContextMenu}
      className={isActive ? 'active' : ''}
      onClick={() => onSwitchTopic(topic)}
      style={{ borderRadius }}
      $showAssistantAvatar={showAssistantAvatar}>
      {isPending && !isActive && <PendingIndicator />}

      {showAssistantAvatar && topic.assistant && <AssistantAvatar>{topic.assistant.emoji}</AssistantAvatar>}

      <TopicContent>
        <TopicNameContainer>
          <TopicName className={getTopicNameClassName()} title={topicName}>
            {topicName}
          </TopicName>
          {!topic.pinned && (
            <Tooltip
              placement="bottom"
              mouseEnterDelay={0.7}
              title={
                <div>
                  <div style={{ fontSize: '12px', opacity: 0.8, fontStyle: 'italic' }}>
                    {t('chat.topics.delete.shortcut', { key: isMac ? '⌘' : 'Ctrl' })}
                  </div>
                </div>
              }>
              <MenuButton
                className="menu"
                onClick={(e) => {
                  if (e.ctrlKey || e.metaKey) {
                    onConfirmDelete(topic, e)
                  } else if (isDeleting) {
                    onConfirmDelete(topic, e)
                  } else {
                    onDeleteClick(topic.id, e)
                  }
                }}>
                {isDeleting ? <DeleteOutlined style={{ color: 'var(--color-error)' }} /> : <CloseOutlined />}
              </MenuButton>
            </Tooltip>
          )}
          {topic.pinned && (
            <MenuButton className="pin">
              <PushpinOutlined />
            </MenuButton>
          )}
        </TopicNameContainer>

        {topicPrompt && (
          <TopicPromptText className="prompt" title={fullTopicPrompt}>
            {fullTopicPrompt}
          </TopicPromptText>
        )}

        {showTopicTime && <TopicTime className="time">{dayjs(topic.updatedAt).format('MM/DD HH:mm')}</TopicTime>}
      </TopicContent>
    </TopicListItem>
  )
}

const TopicListItem = styled.div<{ $showAssistantAvatar?: boolean }>`
  padding: 7px 12px;
  border-radius: var(--list-item-border-radius);
  font-size: 13px;
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 8px;
  position: relative;
  cursor: pointer;
  width: ${(props) =>
    props.$showAssistantAvatar ? 'calc(var(--assistants-width) - 28px)' : 'calc(var(--assistants-width) - 20px)'};

  .menu {
    opacity: 0;
    color: var(--color-text-3);
  }

  &:hover {
    background-color: var(--color-list-item-hover);
    transition: background-color 0.1s;
    .menu {
      opacity: 1;
    }
  }

  &.active {
    background-color: var(--color-list-item);
    .menu {
      opacity: 1;
      &:hover {
        color: var(--color-text-2);
      }
    }
  }
`

const AssistantAvatar = styled.div`
  font-size: 16px;
  flex-shrink: 0;
  margin-top: 1px;
`

const TopicContent = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
`

const TopicNameContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 4px;
  justify-content: space-between;
`

const TopicName = styled.div`
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 13px;
  position: relative;
  will-change: background-position, width;

  --color-shimmer-mid: var(--color-text-1);
  --color-shimmer-end: color-mix(in srgb, var(--color-text-1) 25%, transparent);

  &.shimmer {
    background: linear-gradient(to left, var(--color-shimmer-end), var(--color-shimmer-mid), var(--color-shimmer-end));
    background-size: 200% 100%;
    background-clip: text;
    color: transparent;
    animation: shimmer 3s linear infinite;
  }

  &.typing {
    display: block;
    -webkit-line-clamp: unset;
    -webkit-box-orient: unset;
    white-space: nowrap;
    overflow: hidden;
    animation: typewriter 0.5s steps(40, end);
  }

  @keyframes shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }

  @keyframes typewriter {
    from {
      width: 0;
    }
    to {
      width: 100%;
    }
  }
`

const PendingIndicator = styled.div.attrs({
  className: 'animation-pulse'
})`
  --pulse-size: 5px;
  width: 5px;
  height: 5px;
  position: absolute;
  left: 3px;
  top: 15px;
  border-radius: 50%;
  background-color: var(--color-primary);
`

const TopicPromptText = styled.div`
  color: var(--color-text-2);
  font-size: 12px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  ~ .prompt-text {
    margin-top: 10px;
  }
`

const TopicTime = styled.div`
  color: var(--color-text-3);
  font-size: 12px;
  margin-top: 2px;
`

const MenuButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;

  &:hover {
    background-color: var(--color-background-2);
  }

  &.pin {
    opacity: 1;
    color: var(--color-primary);
  }
`

export default TopicItem
