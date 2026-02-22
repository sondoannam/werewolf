import { forwardRef } from 'react'

const Footer = forwardRef<HTMLDivElement>((_, ref) => {
  return (
    <div ref={ref} className="relative z-30 w-full py-3 text-center">
      <p className="text-slate-600 text-xs tracking-widest uppercase">
        © 2026 Moonfall — A Dark Fantasy Deduction Game
      </p>
    </div>
  )
})

Footer.displayName = 'Footer'

export default Footer
