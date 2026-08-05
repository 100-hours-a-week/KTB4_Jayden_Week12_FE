import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MessageComposer } from './MessageComposer.jsx';

describe('MessageComposer', () => {
  it('instance마다 고유한 label ID를 만들고 textarea ref를 제공한다', () => {
    const firstRef = createRef();
    const secondRef = createRef();
    render(
      <>
        <MessageComposer ref={firstRef} disabled={false} targetName="첫 번째" onSend={vi.fn()} />
        <MessageComposer ref={secondRef} disabled={false} targetName="두 번째" onSend={vi.fn()} />
      </>,
    );

    const inputs = screen.getAllByLabelText('메시지');
    expect(inputs).toHaveLength(2);
    expect(inputs[0].id).not.toBe(inputs[1].id);
    expect(firstRef.current).toBe(inputs[0]);
    expect(secondRef.current).toBe(inputs[1]);
  });
});
