import { BottomSheet } from './BottomSheet'

/** One-time prompt after sign-in: move guest saves from this browser into the account. */
export function MergeSheet({
  count,
  onYes,
  onNotNow,
}: {
  count: number
  onYes: () => void
  onNotNow: () => void
}) {
  const noun = count === 1 ? 'guest save' : 'guest saves'
  return (
    <BottomSheet onClose={onNotNow} label="Move your guest saves">
      {(close) => (
        <>
          <h2 className="sheet__title">
            Move your {count} {noun} to your account?
          </h2>
          <div className="gap-4" />
          <p className="sheet__copy">
            They were saved on this device before you signed in. Moving them keeps everything in
            one gallery.
          </p>
          <div className="gap-20" />
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              onYes()
              close()
            }}
          >
            Yes, move them
          </button>
          <div className="gap-14" />
          <button type="button" className="t-link t-link--muted" style={{ alignSelf: 'center' }} onClick={close}>
            Not now
          </button>
        </>
      )}
    </BottomSheet>
  )
}
