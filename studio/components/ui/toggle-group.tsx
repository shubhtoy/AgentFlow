import * as React from 'react'
import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group'
import { cn } from '@/lib/utils'

const ToggleGroupContext = React.createContext<{ size?: 'default' | 'sm' | 'lg'; variant?: 'default' | 'outline' }>({
  size: 'default',
  variant: 'default',
})

const ToggleGroup = React.forwardRef<
  React.ComponentRef<typeof ToggleGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root> & {
    variant?: 'default' | 'outline'
    size?: 'default' | 'sm' | 'lg'
  }
>(({ className, variant, size, children, ...props }, ref) => (
  <ToggleGroupPrimitive.Root
    ref={ref}
    className={cn('flex items-center justify-center gap-1', className)}
    {...props}
  >
    <ToggleGroupContext.Provider value={{ variant, size }}>
      {children}
    </ToggleGroupContext.Provider>
  </ToggleGroupPrimitive.Root>
))
ToggleGroup.displayName = ToggleGroupPrimitive.Root.displayName

const toggleGroupItemVariants = (variant: string = 'default', size: string = 'default') => {
  const base = 'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors hover:bg-muted hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground'
  const variants: Record<string, string> = {
    default: 'bg-transparent',
    outline: 'border border-input bg-transparent hover:bg-accent hover:text-accent-foreground',
  }
  const sizes: Record<string, string> = {
    default: 'h-10 px-3',
    sm: 'h-9 px-2.5',
    lg: 'h-11 px-5',
  }
  return `${base} ${variants[variant] || variants.default} ${sizes[size] || sizes.default}`
}

const ToggleGroupItem = React.forwardRef<
  React.ComponentRef<typeof ToggleGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item> & {
    variant?: 'default' | 'outline'
    size?: 'default' | 'sm' | 'lg'
  }
>(({ className, variant, size, children, ...props }, ref) => {
  const context = React.useContext(ToggleGroupContext)
  return (
    <ToggleGroupPrimitive.Item
      ref={ref}
      className={cn(toggleGroupItemVariants(variant || context.variant, size || context.size), className)}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Item>
  )
})
ToggleGroupItem.displayName = ToggleGroupPrimitive.Item.displayName

export { ToggleGroup, ToggleGroupItem }
