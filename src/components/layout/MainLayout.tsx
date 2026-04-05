import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import MobileNav from './MobileNav'

export default function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-[#030712]">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-auto pb-16 sm:pb-16 lg:pb-0">
          <div className="p-3 sm:p-5 md:p-6 lg:p-8 max-w-[1440px] mx-auto">
            <Outlet />
          </div>
        </main>
        <MobileNav />
      </div>
    </div>
  )
}
