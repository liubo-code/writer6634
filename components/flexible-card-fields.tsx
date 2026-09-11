'use client';

import { useMemo, useState } from 'react';
import { Eye, EyeOff, Plus, Star, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cardFieldLabel, customFieldKeys, makeCustomFieldKey, type Card } from '@/lib/story';

type Props = {
  card: Card;
  keys: string[];
  includeText?: boolean;
  textPlaceholder?: string;
  onUpdateCard: (patch: Partial<Card>) => void;
  onUpdateField: (key: string, value: string) => void;
};

export default function FlexibleCardFields({
  card,
  keys,
  includeText = true,
  textPlaceholder = '先写最重要的信息，没想好的可以留空。',
  onUpdateCard,
  onUpdateField,
}: Props) {
  const [newLabel, setNewLabel] = useState('');

  const allKeys = useMemo(() => {
    const custom = customFieldKeys(card);
    const extras = Object.keys(card.fields).filter(k => k.startsWith('custom_') && !custom.includes(k));
    return [...new Set([...(includeText ? ['__text'] : []), ...keys, ...custom, ...extras])];
  }, [card.fieldLabels, card.fields, includeText, keys]);

  const visible = allKeys.filter(k => !card.hiddenFields.includes(k));
  const hidden = allKeys.filter(k => card.hiddenFields.includes(k));

  const setLabel = (key: string, value: string) => {
    const next = { ...card.fieldLabels };
    if (value.trim()) next[key] = value;
    else delete next[key];
    onUpdateCard({ fieldLabels: next });
  };

  const toggleHighlight = (key: string) => {
    const next = card.highlightFields.includes(key)
      ? card.highlightFields.filter(k => k !== key)
      : [...card.highlightFields, key];
    onUpdateCard({ highlightFields: next });
  };

  const hide = (key: string) => {
    onUpdateCard({ hiddenFields: [...new Set([...card.hiddenFields, key])] });
  };

  const restore = (key: string) => {
    onUpdateCard({ hiddenFields: card.hiddenFields.filter(k => k !== key) });
  };

  const addField = () => {
    const label = newLabel.trim();
    if (!label) return;
    const key = makeCustomFieldKey();
    onUpdateCard({
      fields: { ...card.fields, [key]: '' },
      fieldLabels: { ...card.fieldLabels, [key]: label },
    });
    setNewLabel('');
  };

  return <div className="flex-fields">
    {visible.map(key => {
      const isText = key === '__text';
      const value = isText ? card.text : (card.fields[key] || '');
      const highlighted = card.highlightFields.includes(key);
      return <section className={'flex-field ' + (highlighted ? 'is-highlighted' : '')} key={key}>
        <div className="flex-field-head">
          <input
            className="flex-field-label"
            aria-label="字段名称"
            value={cardFieldLabel(card, key)}
            onChange={e => setLabel(key, e.target.value)}
          />
          <button
            type="button"
            className={highlighted ? 'active' : ''}
            title={highlighted ? '取消卡片高亮' : '高亮到卡片'}
            aria-label={highlighted ? '取消卡片高亮' : '高亮到卡片'}
            onClick={() => toggleHighlight(key)}
          ><Star size={15}/></button>
          <button type="button" title="隐藏这个字段" aria-label="隐藏这个字段" onClick={() => hide(key)}><EyeOff size={15}/></button>
        </div>
        <textarea
          value={value}
          placeholder={isText ? textPlaceholder : `填写${cardFieldLabel(card, key)}`}
          onChange={e => isText ? onUpdateCard({ text: e.target.value }) : onUpdateField(key, e.target.value)}
        />
      </section>;
    })}

    <div className="flex-field-add">
      <input
        value={newLabel}
        placeholder="新增字段，例如：人物弧光"
        aria-label="新增字段名称"
        onChange={e => setNewLabel(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addField(); } }}
      />
      <Button type="button" variant="outline" size="sm" disabled={!newLabel.trim()} onClick={addField}><Plus size={14}/>添加栏位</Button>
    </div>

    {!!hidden.length && <details className="hidden-fields">
      <summary><Eye size={14}/> 已隐藏字段 · {hidden.length}</summary>
      <div>{hidden.map(key => <button type="button" key={key} onClick={() => restore(key)}><span>{cardFieldLabel(card, key)}</span><X size={13}/></button>)}</div>
    </details>}
  </div>;
}
