import { useContext } from 'react';
import { createPortal } from 'react-dom';
import { HeaderSlotContext } from './headerSlot';

// Pages render this anywhere; its children land in the layout's header bar.
export default function PageHeader({ children }) {
  const slot = useContext(HeaderSlotContext);
  return slot ? createPortal(children, slot) : null;
}
