import type { ComponentChildren, RefObject } from 'preact'
import { useEffect, useId, useState } from 'preact/hooks'

/** Accessible autocomplete (ARIA combobox): type, arrow keys, Enter, or tap. */
export function Combo<T>(props: {
  value: string
  onInput: (v: string) => void
  items: T[]
  render: (item: T) => ComponentChildren
  onPick: (item: T) => void
  placeholder: string
  label: string
  empty?: string | null
  inputRef?: RefObject<HTMLInputElement>
  autoFocus?: boolean
}) {
  const id = useId()
  const [active, setActive] = useState(0)
  useEffect(() => setActive(0), [props.items])
  const open = props.items.length > 0

  function onKey(e: KeyboardEvent) {
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, props.items.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); props.onPick(props.items[active]) }
  }

  return (
    <div class="combo">
      <label for={id} class="sr-only">{props.label}</label>
      <input
        id={id}
        ref={props.inputRef}
        type="search"
        autoComplete="off"
        autoFocus={props.autoFocus ?? true}
        role="combobox"
        aria-expanded={open}
        aria-controls={id + '-list'}
        aria-activedescendant={open ? `${id}-o${active}` : undefined}
        placeholder={props.placeholder}
        value={props.value}
        onInput={(e) => props.onInput((e.target as HTMLInputElement).value)}
        onKeyDown={onKey}
      />
      {open && (
        <ul class="options" role="listbox" id={id + '-list'}>
          {props.items.map((it, i) => (
            <li
              id={`${id}-o${i}`}
              role="option"
              aria-selected={i === active}
              class={i === active ? 'active' : ''}
              onMouseEnter={() => setActive(i)}
              onClick={() => props.onPick(it)}
            >
              {props.render(it)}
            </li>
          ))}
        </ul>
      )}
      {!open && props.empty && <p class="muted small">{props.empty}</p>}
    </div>
  )
}
