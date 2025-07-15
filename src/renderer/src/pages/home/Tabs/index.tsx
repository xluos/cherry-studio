import { DownOutlined, PlusOutlined, UpOutlined } from '@ant-design/icons'
import AddAssistantPopup from '@renderer/components/Popups/AddAssistantPopup'
import { useAgents } from '@renderer/hooks/useAgents'
import { useAssistants, useDefaultAssistant } from '@renderer/hooks/useAssistant'
import { useSettings } from '@renderer/hooks/useSettings'
import { useShowTopics } from '@renderer/hooks/useStore'
import { useAssistantsTabSortType } from '@renderer/hooks/useStore'
import { EVENT_NAMES, EventEmitter } from '@renderer/services/EventService'
import { Assistant, Topic } from '@renderer/types'
import { uuid } from '@renderer/utils'
import { Button, Segmented as AntSegmented, SegmentedProps } from 'antd'
import { FC, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import Assistants from './AssistantsTab'
import AssistantItem from './components/AssistantItem'
import Settings from './SettingsTab'
import Topics from './TopicsTab'

interface Props {
  activeAssistant: Assistant
  activeTopic: Topic
  setActiveAssistant: (assistant: Assistant) => void
  setActiveTopic: (topic: Topic) => void
  position: 'left' | 'right'
  forceToSeeAllTab?: boolean
  style?: React.CSSProperties
}

type Tab = 'assistants' | 'topic' | 'settings'

let _tab: any = ''

const HomeTabs: FC<Props> = ({
  activeAssistant,
  activeTopic,
  setActiveAssistant,
  setActiveTopic,
  position,
  forceToSeeAllTab,
  style
}) => {
  const { addAssistant, assistants } = useAssistants()
  const [tab, setTab] = useState<Tab>(position === 'left' ? _tab || 'assistants' : 'topic')
  const { topicPosition, enableMinimalMode } = useSettings()
  const { defaultAssistant } = useDefaultAssistant()
  const { showTopics, toggleShowTopics } = useShowTopics()

  const { t } = useTranslation()

  const borderStyle = '0.5px solid var(--color-border)'
  const border =
    position === 'left' ? { borderRight: borderStyle } : { borderLeft: borderStyle, borderTopLeftRadius: 0 }

  if (position === 'left' && topicPosition === 'left') {
    _tab = tab
  }

  const showTab = !(position === 'left' && topicPosition === 'right')

  const assistantTab = {
    label: t('assistants.abbr'),
    value: 'assistants'
    // icon: <BotIcon size={16} />
  }

  // 在极简模式下，修改tab选项以合并助手和话题
  const getTabOptions = () => {
    const baseOptions = [
      {
        label: t('common.topics'),
        value: 'topic'
        // icon: <MessageSquareQuote size={16} />
      },
      {
        label: t('settings.title'),
        value: 'settings'
        // icon: <SettingsIcon size={16} />
      }
    ]

    // 只有在非极简模式下才显示助手tab
    if (
      !enableMinimalMode &&
      ((position === 'left' && topicPosition === 'left') || (forceToSeeAllTab == true && position === 'left'))
    ) {
      return [assistantTab, ...baseOptions]
    }

    return baseOptions
  }

  const onCreateAssistant = async () => {
    const assistant = await AddAssistantPopup.show()
    assistant && setActiveAssistant(assistant)
  }

  const onCreateDefaultAssistant = () => {
    const assistant = { ...defaultAssistant, id: uuid() }
    addAssistant(assistant)
    setActiveAssistant(assistant)
  }

  // 极简模式下的助手网格组件
  const MinimalAssistantGrid: FC<{
    assistants: Assistant[]
    activeAssistant: Assistant
    setActiveAssistant: (assistant: Assistant) => void
    onCreateAssistant: () => void
    onCreateDefaultAssistant: () => void
  }> = ({ assistants, activeAssistant, setActiveAssistant, onCreateAssistant, onCreateDefaultAssistant }) => {
    const { addAgent } = useAgents()
    const { assistantsTabSortType = 'list' } = useAssistantsTabSortType()
    const [showAll, setShowAll] = useState(false)
    const { removeAssistant } = useAssistants()

    // 限制显示的助手数量（3行 x 3列 = 9个）
    const maxVisible = 9
    const visibleAssistants = showAll ? assistants : assistants.slice(0, maxVisible)
    const hasMore = assistants.length > maxVisible

    const onDelete = (assistant: Assistant) => {
      const remaining = assistants.filter((a) => a.id !== assistant.id)
      if (assistant.id === activeAssistant?.id) {
        const newActive = remaining[remaining.length - 1]
        newActive ? setActiveAssistant(newActive) : onCreateDefaultAssistant()
      }
      removeAssistant(assistant.id)
    }

    return (
      <MinimalGridContainer>
        <AssistantGrid>
          {visibleAssistants.map((assistant) => (
            <GridAssistantItem key={assistant.id}>
              <AssistantItem
                assistant={assistant}
                isActive={assistant.id === activeAssistant.id}
                sortBy={assistantsTabSortType}
                onSwitch={setActiveAssistant}
                onDelete={onDelete}
                onCreateDefaultAssistant={onCreateDefaultAssistant}
                addAgent={addAgent}
                addAssistant={addAssistant}
                gridMode={true}
              />
            </GridAssistantItem>
          ))}
          {/* 固定的添加助手按钮 */}
          <GridAssistantItem>
            <AddAssistantButton onClick={onCreateAssistant}>
              <AddAssistantIcon>
                <PlusOutlined />
              </AddAssistantIcon>
            </AddAssistantButton>
          </GridAssistantItem>
        </AssistantGrid>

        {hasMore && (
          <CollapseButton onClick={() => setShowAll(!showAll)}>
            {showAll ? <UpOutlined /> : <DownOutlined />}
            {showAll ? t('common.collapse') : t('common.expand')}
          </CollapseButton>
        )}
      </MinimalGridContainer>
    )
  }

  useEffect(() => {
    const unsubscribes = [
      EventEmitter.on(EVENT_NAMES.SHOW_ASSISTANTS, (): any => {
        if (enableMinimalMode && topicPosition === 'left') {
          showTab && setTab('topic')
        } else {
          showTab && setTab('assistants')
        }
      }),
      EventEmitter.on(EVENT_NAMES.SHOW_TOPIC_SIDEBAR, (): any => {
        showTab && setTab('topic')
      }),
      EventEmitter.on(EVENT_NAMES.SHOW_CHAT_SETTINGS, (): any => {
        showTab && setTab('settings')
      }),
      EventEmitter.on(EVENT_NAMES.SWITCH_TOPIC_SIDEBAR, () => {
        showTab && setTab('topic')
        if (position === 'left' && topicPosition === 'right') {
          toggleShowTopics()
        }
      })
    ]
    return () => unsubscribes.forEach((unsub) => unsub())
  }, [position, showTab, tab, toggleShowTopics, topicPosition, enableMinimalMode])

  useEffect(() => {
    if (position === 'right' && topicPosition === 'right' && tab === 'assistants') {
      setTab('topic')
    }
    if (position === 'left' && topicPosition === 'right' && forceToSeeAllTab != true && tab !== 'assistants') {
      setTab('assistants')
    }
    // 极简模式下，如果当前是助手tab，自动切换到话题tab，但只在话题位置为左侧时
    if (enableMinimalMode && topicPosition === 'left' && tab === 'assistants') {
      setTab('topic')
    }
  }, [position, tab, topicPosition, forceToSeeAllTab, enableMinimalMode])

  return (
    <Container style={{ ...border, ...style }} className="home-tabs">
      {/* 极简模式下直接显示助手网格布局，但只在话题位置为左侧时 */}
      {enableMinimalMode && topicPosition === 'left' ? (
        <MinimalAssistantGrid
          assistants={assistants}
          activeAssistant={activeAssistant}
          setActiveAssistant={setActiveAssistant}
          onCreateAssistant={onCreateAssistant}
          onCreateDefaultAssistant={onCreateDefaultAssistant}
        />
      ) : (
        <>
          {(showTab || (forceToSeeAllTab == true && !showTopics)) && (
            <>
              <Segmented
                value={tab}
                style={{ borderRadius: 50 }}
                shape="round"
                options={getTabOptions().filter(Boolean) as SegmentedProps['options']}
                onChange={(value) => setTab(value as Tab)}
                block
              />
              <Divider />
            </>
          )}

          <TabContent className="home-tabs-content">
            {tab === 'assistants' && (
              <Assistants
                activeAssistant={activeAssistant}
                setActiveAssistant={setActiveAssistant}
                onCreateAssistant={onCreateAssistant}
                onCreateDefaultAssistant={onCreateDefaultAssistant}
              />
            )}
            {tab === 'topic' && (
              <Topics assistant={activeAssistant} activeTopic={activeTopic} setActiveTopic={setActiveTopic} />
            )}
            {tab === 'settings' && <Settings assistant={activeAssistant} />}
          </TabContent>
        </>
      )}

      {/* 极简模式下，助手网格下方显示话题列表，但只在话题位置为左侧时 */}
      {enableMinimalMode && topicPosition === 'left' && (
        <TabContent className="home-tabs-content">
          <Topics assistant={activeAssistant} activeTopic={activeTopic} setActiveTopic={setActiveTopic} />
        </TabContent>
      )}
    </Container>
  )
}

const MinimalGridContainer = styled.div`
  padding: 10px;
  border-bottom: 0.5px solid var(--color-border);
`

const AssistantGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 10px;
`

const GridAssistantItem = styled.div`
  .ant-dropdown-trigger {
    width: 100%;
    height: 100%;
  }
`

const CollapseButton = styled(Button)`
  width: 100%;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;

  &:hover {
    background-color: var(--color-list-item-hover);
    color: var(--color-text);
  }
`

const Container = styled.div`
  display: flex;
  flex-direction: column;
  max-width: var(--assistants-width);
  min-width: var(--assistants-width);
  background-color: var(--color-background);
  overflow: hidden;
  .collapsed {
    width: 0;
    border-left: none;
  }
`

const TabContent = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;
`

const Divider = styled.div`
  border-top: 0.5px solid var(--color-border);
  margin-top: 10px;
  margin-left: 10px;
  margin-right: 10px;
`

const Segmented = styled(AntSegmented)`
  font-family: var(--font-family);

  &.ant-segmented {
    background-color: transparent;
    margin: 0 10px;
    margin-top: 10px;
    padding: 0;
  }
  .ant-segmented-item {
    overflow: hidden;
    transition: none !important;
    height: 34px;
    line-height: 34px;
    background-color: transparent;
    user-select: none;
    border-radius: var(--list-item-border-radius);
    box-shadow: none;
  }
  .ant-segmented-item-selected,
  .ant-segmented-item-selected:active {
    transition: none !important;
    background-color: var(--color-list-item);
  }
  .ant-segmented-item-label {
    align-items: center;
    display: flex;
    flex-direction: row;
    justify-content: center;
    font-size: 13px;
    height: 100%;
  }
  .ant-segmented-item-label[aria-selected='true'] {
    color: var(--color-text);
  }
  .icon-business-smart-assistant {
    margin-right: -2px;
  }
  .ant-segmented-thumb {
    transition: none !important;
    background-color: var(--color-list-item);
    border-radius: var(--list-item-border-radius);
    box-shadow: none;
    &:hover {
      background-color: transparent;
    }
  }
  .ant-segmented-item-label,
  .ant-segmented-item-icon {
    display: flex;
    align-items: center;
  }
  /* These styles ensure the same appearance as before */
  border-radius: 0;
  box-shadow: none;
`

const AddAssistantButton = styled.div`
  width: 100%;
  height: 100%;
  padding: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  border: 1px dashed var(--color-border);
  border-radius: var(--list-item-border-radius);
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--color-text-secondary);

  &:hover {
    background-color: var(--color-list-item-hover);
    border-color: var(--color-primary);
    color: var(--color-primary);
  }
`

const AddAssistantIcon = styled.div`
  font-size: 24px;
`

export default HomeTabs
