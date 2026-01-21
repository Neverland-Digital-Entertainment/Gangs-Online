import Link from 'next/link';
import { Bot, FileText, MapPin, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function NpcManagementQuickLinks() {
  const links = [
    {
      icon: FileText,
      title: 'NPC Templates',
      description: 'Manage NPC definitions',
      href: '/npc-management/templates',
      color: 'text-blue-500',
      bgColor: 'bg-blue-50 dark:bg-blue-950',
    },
    {
      icon: MapPin,
      title: 'NPC Instances',
      description: 'Place NPCs on the map',
      href: '/npc-management/instances',
      color: 'text-green-500',
      bgColor: 'bg-green-50 dark:bg-green-950',
    },
  ];

  const quickActions = [
    {
      icon: Plus,
      label: 'New Template',
      href: '/npc-management/templates',
    },
    {
      icon: Plus,
      label: 'New Instance',
      href: '/npc-management/instances',
    },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          NPC Management
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {links.map((link, index) => (
          <Link
            key={index}
            href={link.href}
            className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
          >
            <div className={`p-2 rounded-lg ${link.bgColor}`}>
              <link.icon className={`h-5 w-5 ${link.color}`} />
            </div>
            <div className="flex-1">
              <div className="font-medium text-sm">{link.title}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                {link.description}
              </div>
            </div>
          </Link>
        ))}

        <div className="border-t pt-4 mt-4">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
            Quick Actions
          </div>
          <div className="flex gap-2">
            {quickActions.map((action, index) => (
              <Link key={index} href={action.href} className="flex-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs justify-start"
                >
                  <action.icon className="h-3 w-3" />
                  {action.label}
                </Button>
              </Link>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
