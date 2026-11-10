'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowRight, ArrowUpRight, Check, ChefHat, Minus, Plus, QrCode, RotateCcw, Smartphone, Ticket } from 'lucide-react'
import Link from 'next/link'
import landing from '../service-pass.module.css'
import styles from './table-demo.module.css'

const menu = [
    { id: 'biryani', name: 'Chicken biryani', detail: 'Basmati rice · house spices', price: 690, mark: '01' },
    { id: 'lemonade', name: 'Mint lemonade', detail: 'Fresh mint · lime', price: 240, mark: '02' },
] as const

type MenuId = (typeof menu)[number]['id']
type Stage = 'menu' | 'sent' | 'ready'

export function TableDemo() {
    const [quantity, setQuantity] = useState<Record<MenuId, number>>({ biryani: 0, lemonade: 0 })
    const [stage, setStage] = useState<Stage>('menu')
    const previousStage = useRef<Stage>('menu')
    const firstAdd = useRef<HTMLButtonElement>(null)
    const readyAction = useRef<HTMLButtonElement>(null)
    const resetAction = useRef<HTMLButtonElement>(null)

    useEffect(() => {
        if (previousStage.current === stage) return
        previousStage.current = stage
        const next = stage === 'sent' ? readyAction : stage === 'ready' ? resetAction : firstAdd
        next.current?.focus()
    }, [stage])
    const chosen = menu.filter(item => quantity[item.id] > 0)
    const total = chosen.reduce((sum, item) => sum + item.price * quantity[item.id], 0)
    const totalLabel = `Rs ${total.toLocaleString('en-PK')}`

    function adjust(id: MenuId, difference: number) {
        setQuantity(current => ({ ...current, [id]: Math.max(0, Math.min(9, current[id] + difference)) }))
    }

    function reset() {
        setQuantity({ biryani: 0, lemonade: 0 })
        if (stage === 'menu') firstAdd.current?.focus()
        else setStage('menu')
    }

    return <section id="table-demo" className={styles.section} aria-labelledby="table-demo-title">
        <div className={landing.container}>
            <div className={styles.grid}>
                <div className={styles.copy}>
                    <p className={landing.eyebrow}><span /> QR ORDERING</p>
                    <h2 id="table-demo-title">From the table to the kitchen.</h2>
                    <p>Guests scan the table’s QR code and order from their phones. Your kitchen gets the items and table number on the same ticket.</p>
                    <div className={styles.useCase}><QrCode size={22} aria-hidden="true" /><div><strong>Each table has its own code</strong><p>Update the menu in NexusPOS and keep using the same printed code.</p></div></div>
                    <Link href="/register" className={landing.textLink}>Set up QR ordering <ArrowUpRight size={17} aria-hidden="true" /></Link>
                </div>
                <div className={styles.lab}>
                    <header className={styles.labTop}><span>TABLE 08</span><small>INTERACTIVE SAMPLE</small></header>
                    <div className={styles.stations}>
                        <section className={styles.station} aria-label="Guest menu demo">
                            <header><Smartphone size={15} aria-hidden="true" /> Guest phone</header>
                            <div className={styles.menu}>
                                <div className={styles.menuTop}><QrCode size={18} aria-hidden="true" /><div><small>TABLE 08</small><strong>Copper &amp; Lime</strong></div></div>
                                {stage === 'menu' ? <>
                                    <ul>
                                        {menu.map(item => <li key={item.id}>
                                            <span className={styles.menuNumber} aria-hidden="true">{item.mark}</span>
                                            <div><strong>{item.name}</strong><small>{item.detail}</small><span>Rs {item.price}</span></div>
                                            <div className={styles.quantity}>
                                                {!!quantity[item.id] && <><button type="button" aria-label={`Remove ${item.name}`} onClick={() => adjust(item.id, -1)}><Minus size={15} aria-hidden="true" /></button><span>{quantity[item.id]}</span></>}
                                                <button type="button" ref={item.id === menu[0].id ? firstAdd : undefined} aria-label={`Add ${item.name}`} disabled={quantity[item.id] === 9} onClick={() => adjust(item.id, 1)}><Plus size={15} aria-hidden="true" /></button>
                                            </div>
                                        </li>)}
                                    </ul>
                                    <button type="button" className={styles.action} disabled={!chosen.length} onClick={() => setStage('sent')}>Send sample order <span>{totalLabel}</span></button>
                                </> : <div className={styles.confirmed} key={stage}>
                                    <span><Check size={19} aria-hidden="true" /></span><strong>{stage === 'ready' ? 'Your order is ready' : 'Order sent'}</strong>
                                    <p>Order #1084 · {totalLabel}</p>
                                </div>}
                            </div>
                        </section>
                        <div className={styles.connector} data-sent={stage !== 'menu'} aria-hidden="true"><ArrowRight size={20} /></div>
                        <section className={styles.station} aria-label="Kitchen ticket demo">
                            <header><ChefHat size={16} aria-hidden="true" /> Kitchen screen</header>
                            {stage === 'menu' ? <div className={styles.empty}><Ticket size={30} aria-hidden="true" /><p>The ticket appears after you send the order.</p></div>
                                : <div className={styles.ticket} data-ready={stage === 'ready'}>
                                    <div className={styles.ticketTop}><div><small>TABLE 08 · QR</small><strong>#1084</strong></div><span>{stage === 'ready' ? 'Ready' : 'New'}</span></div>
                                    <ul>{chosen.map(item => <li key={item.id}><b>{quantity[item.id]}×</b> {item.name}</li>)}</ul>
                                    {stage === 'sent' && <button type="button" className={styles.action} ref={readyAction} onClick={() => setStage('ready')}>Mark ready <Check size={16} aria-hidden="true" /></button>}
                                </div>}
                        </section>
                    </div>
                    <div className={styles.labFoot}>
                        <p role="status">{stage === 'ready' ? 'Order ready on both screens.' : stage === 'sent' ? 'Sample ticket sent to the kitchen.' : 'Add an item to try the flow. No real order is placed.'}</p>
                        {(stage !== 'menu' || total > 0) && <button type="button" ref={resetAction} onClick={reset}><RotateCcw size={14} aria-hidden="true" /> Reset demo</button>}
                    </div>
                </div>
            </div>
        </div>
    </section>
}
