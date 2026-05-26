export interface CsvStaffRow {
    name: string
    email: string
    phone: string
    role: string
    shift: string
    status: string
    setup: string
    hire_date: string
    invited_at: string
    last_login: string
    emergency_contact: string
}

export function exportStaffToCSV(rows: CsvStaffRow[], filename?: string): void {
    const headers = [
        'Name',
        'Email',
        'Phone',
        'Role',
        'Shift',
        'Status',
        'Setup',
        'Hire Date',
        'Invited At',
        'Last Login',
        'Emergency Contact',
    ]

    const escapeCsv = (val: string) => {
        const str = String(val ?? '').replace(/"/g, '""')
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str}"`
        }
        return str
    }

    const lines = [
        headers.join(','),
        ...rows.map((row) =>
            [
                row.name,
                row.email,
                row.phone,
                row.role,
                row.shift,
                row.status,
                row.setup,
                row.hire_date,
                row.invited_at,
                row.last_login,
                row.emergency_contact,
            ]
                .map(escapeCsv)
                .join(',')
        ),
    ]

    const csvContent = '\uFEFF' + lines.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)

    link.setAttribute('href', url)
    link.setAttribute('download', filename || `staff-export-${new Date().toISOString().slice(0, 10)}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
}
