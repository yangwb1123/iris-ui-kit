import * as React from 'react'
import { IrisAlert, IrisButton, IrisCard, IrisInput } from '@iris-ui-kit/react'
import type { AeroIdClient } from '../api/aeroId'
import { PageHeader } from '../components/PageHeader'
import { PageError, PageLoading } from '../components/PageState'
import { useAsyncResource } from '../hooks/useAsyncResource'
import type { Profile } from '../types'

const fields = [
  ['display_name', '显示名称'],
  ['avatar_url', '头像 URL'],
  ['locale', '语言'],
  ['timezone', '时区'],
] as const

export function ProfilePage({ client }: { client: AeroIdClient }): React.ReactElement {
  const load = React.useCallback(() => client.getProfile(), [client])
  const resource = useAsyncResource(load)
  const [draft, setDraft] = React.useState<Partial<Profile>>({})
  const [saving, setSaving] = React.useState(false)
  const [saved, setSaved] = React.useState(false)
  const [saveError, setSaveError] = React.useState<Error>()
  const [eraseConfirmation, setEraseConfirmation] = React.useState('')
  const [erasing, setErasing] = React.useState(false)
  const [eraseError, setEraseError] = React.useState<Error>()
  const [eraseJob, setEraseJob] = React.useState<Record<string, unknown>>()

  React.useEffect(() => {
    if (resource.data) setDraft(resource.data)
  }, [resource.data])
  if (resource.loading) return <PageLoading />
  if (resource.error) return <PageError error={resource.error} retry={resource.reload} />

  const save = async () => {
    setSaving(true)
    setSaved(false)
    setSaveError(undefined)
    try {
      const updated = await client.updateProfile({
        display_name: draft.display_name ?? '',
        avatar_url: draft.avatar_url ?? '',
        locale: draft.locale ?? '',
        timezone: draft.timezone ?? '',
      })
      resource.replace(updated)
      setSaved(true)
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason : new Error('保存失败'))
    } finally {
      setSaving(false)
    }
  }

  const accountID = String(resource.data?.account_id ?? '')
  const erase = async () => {
    if (!accountID || eraseConfirmation.trim() !== accountID) return
    setErasing(true)
    setEraseError(undefined)
    try {
      setEraseJob(await client.createEraseJob())
      setEraseConfirmation('')
    } catch (reason) {
      setEraseError(reason instanceof Error ? reason : new Error('账户删除任务创建失败'))
    } finally {
      setErasing(false)
    }
  }

  return (
    <section>
      <PageHeader title="个人资料" description="这里只修改 aero-id 明确拥有的展示和偏好字段。" />
      <IrisAlert tone="info" title="身份字段由 Snaplink 管理">
        邮箱、电话、验证状态、MFA 和账户生命周期不能在这里修改。
      </IrisAlert>
      {saveError ? <IrisAlert tone="danger">{saveError.message}</IrisAlert> : null}
      {saved ? <IrisAlert tone="success">资料已保存。</IrisAlert> : null}
      <IrisCard variant="outline">
        <form
          className="profile-form"
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          {fields.map(([key, label]) => (
            <label className="form-row" key={key}>
              <span>{label}</span>
              <IrisInput
                value={String(draft[key] ?? '')}
                onChange={(event) => setDraft((value) => ({ ...value, [key]: event.target.value }))}
              />
            </label>
          ))}
          <div className="form-actions">
            <IrisButton type="submit" loading={saving}>
              保存资料
            </IrisButton>
          </div>
        </form>
      </IrisCard>
      <IrisCard variant="outline" header="危险操作" className="danger-zone">
        <IrisAlert tone="danger" title="删除聚合账户">
          该操作会创建异步 erase
          Saga，并请求各来源系统删除可删除的数据。结果必须在“同步与导出”中跟踪；unknown
          状态不能视为删除失败后直接重试。
        </IrisAlert>
        {eraseError ? <IrisAlert tone="danger">{eraseError.message}</IrisAlert> : null}
        {eraseJob ? (
          <IrisAlert tone="success" title="删除任务已创建">
            任务 ID：{String(eraseJob.job_id ?? eraseJob.id ?? '已接受')}，状态：
            {String(eraseJob.status ?? 'pending')}
          </IrisAlert>
        ) : null}
        <label className="form-row">
          <span>输入账户 ID 确认</span>
          <IrisInput
            value={eraseConfirmation}
            placeholder={accountID || '账户 ID 暂不可用'}
            aria-describedby="erase-account-help"
            onChange={(event) => setEraseConfirmation(event.target.value)}
          />
        </label>
        <p id="erase-account-help" className="muted">
          仅当输入与当前账户 ID {accountID || '—'} 完全一致时才能提交。
        </p>
        <div className="form-actions">
          <IrisButton
            variant="outline"
            loading={erasing}
            disabled={!accountID || eraseConfirmation.trim() !== accountID}
            onClick={() => void erase()}
          >
            创建账户删除任务
          </IrisButton>
        </div>
      </IrisCard>
    </section>
  )
}
