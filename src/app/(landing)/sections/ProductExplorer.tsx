'use client'

import { useState } from 'react'
import { ArrowRight, Bike, ChartNoAxesColumnIncreasing, Check, ClipboardList, Film, ImageIcon, Monitor, Package, Rocket, Users } from 'lucide-react'
import styles from '../service-pass.module.css'
import demo from './product-explorer.module.css'

const workflows = [
    { id: 'setup', label: 'Open your restaurant', icon: Rocket, title: 'Get ready for opening day.', copy: 'Set up your restaurant, build a menu, and give staff their own station before guests arrive.', details: ['Menu and specials', 'Staff access and shifts', 'Tables and QR codes'], actions: ['Publish sample menu', 'Invite sample team', 'Reset setup'], states: ['Menu draft', 'Menu published', 'Team invited'] },
    { id: 'service', label: 'Serve guests', icon: ClipboardList, title: 'Follow an order across the floor.', copy: 'Take orders by QR or at the counter. Send them to the kitchen, then give the waiter or cashier a clear handoff.', details: ['Guest ordering and reservations', 'Kitchen tickets and waiter station', 'Counter and payments'], actions: ['Send to kitchen', 'Mark order ready', 'Reset order'], states: ['Order received', 'In the kitchen', 'Ready for handoff'] },
    { id: 'delivery', label: 'Send deliveries', icon: Bike, title: 'Know who has the order.', copy: 'Assign a rider, follow pickup and drop-off, and record cash collected at the door.', details: ['Dispatch board and rider roster', 'Phone workflow and trip location', 'Guest tracking and cash handoff'], actions: ['Assign sample rider', 'Confirm pickup', 'Reset delivery'], states: ['Needs a rider', 'Assigned to Amina', 'Out for delivery'] },
    { id: 'signage', label: 'Advertise on screens', icon: Monitor, title: 'Turn a window into an ad screen.', copy: 'Upload a poster or video, choose where it plays, and preview the playlist before you put it in front of guests.', details: ['Images and video playlists', 'Storefront and waiting-area screens', 'Schedule promotions'], actions: ['Preview next slide', 'Preview first slide'], states: ['Lunch poster', 'Evening video concept'] },
    { id: 'team', label: 'Manage the back office', icon: Users, title: 'Keep staff and stock in view.', copy: 'Plan shifts, record stock changes and expenses, and give staff access to the parts of the business they need.', details: ['Staff permissions and shifts', 'Inventory and expenses', 'Staff performance and tips'], actions: ['Record sample stock use', 'Reset stock'], states: ['18 portions available', '12 portions available'] },
    { id: 'insights', label: 'Grow the business', icon: ChartNoAxesColumnIncreasing, title: 'Use each shift to plan the next.', copy: 'Review sales and expenses, then use loyalty, offers, and guest feedback to understand what brings people back.', details: ['Sales reports and analytics', 'Discounts and loyalty', 'Guest feedback'], actions: ['View sample week', 'View sample day'], states: ['Today’s sales', 'This week’s sales'] },
] as const

type Workflow = (typeof workflows)[number]

export function ProductExplorer() {
    const [selected, setSelected] = useState<number>(0)
    const [phase, setPhase] = useState(0)
    const flow = workflows[selected]

    function select(index: number) {
        setSelected(index)
        setPhase(0)
    }

    return <section id="features" className={demo.section} aria-labelledby="feature-title">
        <div className={styles.container}>
            <div className={demo.intro}>
                <div className={styles.sectionHeading}>
                    <p className={styles.eyebrow}><span /> EXPLORE NEXUSPOS</p>
                    <h2 id="feature-title">Take the product for a spin.</h2>
                </div>
                <p>Choose a workflow and try it with sample data. See what owners, staff, and guests see at each step.</p>
            </div>
            <div className={demo.workspace}>
                <nav className={demo.rail} aria-label="Product workflows">
                    {workflows.map(({ id, label, icon: Icon }, index) => <button key={id} type="button"
                        aria-pressed={selected === index} aria-controls="feature-workflow" onClick={() => select(index)}>
                        <Icon size={18} aria-hidden="true" /><span>{label}</span><small aria-hidden="true">{String(index + 1).padStart(2, '0')}</small>
                    </button>)}
                </nav>
                <div id="feature-workflow" className={demo.panel}>
                    <div key={flow.id} className={demo.content}>
                        <div className={demo.copy}>
                            <p className={demo.micro}>WORKFLOW {String(selected + 1).padStart(2, '0')} / 06</p>
                            <h3>{flow.title}</h3>
                            <p>{flow.copy}</p>
                            <ul>{flow.details.map(detail => <li key={detail}><Check size={15} aria-hidden="true" />{detail}</li>)}</ul>
                        </div>
                        <div className={demo.console}>
                            <div className={demo.consoleHead}><span><i /> {flow.label}</span><small>INTERACTIVE SAMPLE</small></div>
                            <WorkflowPreview flow={flow} phase={phase} />
                            <div className={demo.consoleFoot}>
                                <p role="status">{flow.states[phase]}</p>
                                <button type="button" onClick={() => setPhase((phase + 1) % flow.actions.length)}>{flow.actions[phase]} <ArrowRight size={16} aria-hidden="true" /></button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>
}

function WorkflowPreview({ flow, phase }: { flow: Workflow; phase: number }) {
    if (flow.id === 'signage') return <div className={demo.mock}>
        <div className={demo.tv} key={phase} data-promo={phase} aria-label={phase ? 'Evening promotion' : 'Lunch promotion'}>
            <div className={demo.posterArt} aria-hidden="true"><i /><i /><i /></div>
            <div className={demo.posterCopy}><small>COPPER &amp; LIME</small>
                <strong>{phase ? <>After<br />hours.</> : <>Lunch<br />is on.</>}</strong>
                <span>{phase ? 'FRIDAY · FROM 6 PM' : 'WEEKDAYS · 12–3 PM'}</span>
            </div>
        </div>
        <div className={demo.mockMeta}><span><Monitor size={15} aria-hidden="true" /> Street window</span>
            <span>{phase ? <Film size={15} aria-hidden="true" /> : <ImageIcon size={15} aria-hidden="true" />} {phase ? 'Video' : 'Image'} · {phase + 1} / 2</span></div>
    </div>

    if (flow.id === 'insights') return <div className={demo.mock}>
        <div className={demo.dataTop}><span>{flow.states[phase]}</span><strong>{phase ? 'Rs 321,480' : 'Rs 48,620'}</strong></div>
        <div className={demo.chart} role="img" aria-label={phase ? 'Sample sales by day of the week' : 'Sample sales by hour'}>
            {(phase ? [37, 52, 43, 64, 87, 100, 74] : [25, 45, 83, 61, 37, 72, 94]).map((height, index) => <span key={index} style={{ height: `${height}%` }} />)}
        </div>
        <div className={demo.mockMeta}><span>{phase ? 'Mon' : '12 PM'}</span><span>{phase ? 'Sun' : '9 PM'}</span></div>
    </div>

    const records = flow.id === 'setup'
        ? [{ title: 'Restaurant profile', detail: 'Copper & Lime', done: true }, { title: 'Menu', detail: phase ? 'Published' : 'Draft', done: phase > 0 }, { title: 'Staff access', detail: phase > 1 ? 'Invited' : 'Pending', done: phase > 1 }]
        : flow.id === 'service'
            ? [{ title: 'Order #1084', detail: 'Table 08 · QR order', done: true }, { title: 'Kitchen ticket', detail: phase ? 'Sent to kitchen' : 'Waiting to send', done: phase > 0 }, { title: 'Handoff', detail: phase > 1 ? 'Ready for waiter' : 'Waiting', done: phase > 1 }]
            : flow.id === 'delivery'
                ? [{ title: 'Order #1089', detail: 'Clifton · Cash at the door', done: true }, { title: 'Rider', detail: phase ? 'Amina Raza' : 'Unassigned', done: phase > 0 }, { title: 'Pickup', detail: phase > 1 ? 'Confirmed' : 'Waiting', done: phase > 1 }]
                : [{ title: 'Chicken biryani', detail: flow.states[phase], done: true }, { title: 'Stock used', detail: phase ? '6 portions recorded' : 'No change', done: phase > 0 }, { title: 'Evening shift', detail: '4 staff assigned', done: true }]
    const Icon = flow.id === 'team' ? Package : flow.icon
    return <div className={demo.mock}>
        <ol className={demo.records}>{records.map(({ title, detail, done }) => <li key={title} data-done={done}>
            <span className={demo.recordIcon}>{done ? <Check size={17} aria-hidden="true" /> : <Icon size={17} aria-hidden="true" />}</span>
            <strong>{title}</strong><span>{detail}</span>
        </li>)}</ol>
    </div>
}
