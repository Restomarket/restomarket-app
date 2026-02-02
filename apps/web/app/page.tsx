'use client';

import { useState } from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@repo/ui/avatar';
import { Input } from '@repo/ui/input';
import { Label } from '@repo/ui/label';
import { Separator } from '@repo/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@repo/ui/select';
import { Badge } from '@repo/ui/badge';

export default function Home() {
  const [name, setName] = useState('');
  const [selectedRole, setSelectedRole] = useState('');

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header Section */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <Avatar className="h-24 w-24">
              <AvatarImage src="https://github.com/shadcn.png" alt="User" />
              <AvatarFallback>RM</AvatarFallback>
            </Avatar>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Welcome to RestoMarket
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Built with Next.js, Turborepo, and shadcn/ui components
          </p>
          <div className="flex justify-center gap-2 mt-4">
            <Badge variant="default">Active</Badge>
            <Badge variant="secondary">Monorepo</Badge>
            <Badge variant="outline">TypeScript</Badge>
          </div>
        </div>

        <Separator className="my-8" />

        {/* Form Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-semibold mb-6 text-gray-900 dark:text-white">
            User Profile
          </h2>

          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="Enter your name"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" type="email" placeholder="your.email@example.com" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Select Role</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger id="role">
                  <SelectValue placeholder="Choose your role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrator</SelectItem>
                  <SelectItem value="manager">Restaurant Manager</SelectItem>
                  <SelectItem value="staff">Staff Member</SelectItem>
                  <SelectItem value="customer">Customer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {name && (
              <div className="pt-4">
                <Badge variant="secondary" className="text-lg px-4 py-2">
                  Hello, {name}! 👋
                </Badge>
              </div>
            )}
          </div>
        </div>

        {/* Features Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FeatureCard
            title="Fast Development"
            description="Turborepo enables lightning-fast builds and hot reloading"
            badge="Performance"
          />
          <FeatureCard
            title="Type Safety"
            description="Full TypeScript support across all packages"
            badge="TypeScript"
          />
          <FeatureCard
            title="Modern UI"
            description="Beautiful components powered by shadcn/ui"
            badge="Design"
          />
        </div>
      </div>
    </div>
  );
}

function FeatureCard({
  title,
  description,
  badge,
}: {
  title: string;
  description: string;
  badge: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-xl transition-shadow">
      <Badge className="mb-3">{badge}</Badge>
      <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">{title}</h3>
      <p className="text-gray-600 dark:text-gray-300">{description}</p>
    </div>
  );
}
