import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { Edit, Trash2, Plus } from 'lucide-react';
import { z } from 'zod';

interface Region {
  id: string;
  name: string;
  description: string | null;
  regional_manager_id: string | null;
  created_at: string;
  regional_manager?: {
    name: string;
  };
}

interface Profile {
  id: string;
  name: string;
  role: string;
}

const regionSchema = z.object({
  name: z.string().trim().min(1, "Region name is required").max(100, "Region name must be less than 100 characters"),
  description: z.string().max(500, "Description must be less than 500 characters").optional(),
  regional_manager_id: z.string().optional()
});

export default function RegionManagement() {
  const { profile } = useAuth();
  const [regions, setRegions] = useState<Region[]>([]);
  const [regionalManagers, setRegionalManagers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRegion, setEditingRegion] = useState<Region | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    regional_manager_id: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if ((profile?.role as string) === 'admin') {
      fetchRegions();
      fetchRegionalManagers();
    }
  }, [profile]);

  const fetchRegions = async () => {
    try {
      const { data, error } = await supabase
        .from('regions')
        .select(`
          *,
          regional_manager:profiles!regional_manager_id(name)
        `)
        .order('name');

      if (error) throw error;
      setRegions(data || []);
    } catch (error) {
      console.error('Error fetching regions:', error);
      toast({
        title: "Error",
        description: "Failed to fetch regions",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchRegionalManagers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, role')
        .eq('role', 'regional_manager');

      if (error) throw error;
      setRegionalManagers(data || []);
    } catch (error) {
      console.error('Error fetching regional managers:', error);
    }
  };

  const validateForm = () => {
    try {
      regionSchema.parse(formData);
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    try {
      const regionData = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        regional_manager_id: formData.regional_manager_id || null
      };

      if (editingRegion) {
        const { error } = await supabase
          .from('regions')
          .update(regionData)
          .eq('id', editingRegion.id);

        if (error) throw error;
        toast({
          title: "Success",
          description: "Region updated successfully"
        });
      } else {
        const { error } = await supabase
          .from('regions')
          .insert([regionData]);

        if (error) throw error;
        toast({
          title: "Success",
          description: "Region created successfully"
        });
      }

      resetForm();
      fetchRegions();
    } catch (error) {
      console.error('Error saving region:', error);
      toast({
        title: "Error",
        description: "Failed to save region",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this region? This will also delete all associated districts and branches.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('regions')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Region deleted successfully"
      });
      fetchRegions();
    } catch (error) {
      console.error('Error deleting region:', error);
      toast({
        title: "Error",
        description: "Failed to delete region",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      regional_manager_id: ''
    });
    setEditingRegion(null);
    setIsModalOpen(false);
    setErrors({});
  };

  const openEditModal = (region: Region) => {
    setFormData({
      name: region.name,
      description: region.description || '',
      regional_manager_id: region.regional_manager_id || ''
    });
    setEditingRegion(region);
    setIsModalOpen(true);
  };

  const filteredRegions = regions.filter(region =>
    region.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    region.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if ((profile?.role as string) !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Access Denied</h2>
          <p>You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Region Management</h1>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()}>
              <Plus className="mr-2 h-4 w-4" />
              Add Region
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingRegion ? 'Edit Region' : 'Add New Region'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Region Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className={errors.name ? "border-destructive" : ""}
                />
                {errors.name && <p className="text-sm text-destructive mt-1">{errors.name}</p>}
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className={errors.description ? "border-destructive" : ""}
                />
                {errors.description && <p className="text-sm text-destructive mt-1">{errors.description}</p>}
              </div>

              <div>
                <Label htmlFor="regional_manager">Regional Manager</Label>
                <Select
                  value={formData.regional_manager_id}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, regional_manager_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select regional manager" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No Manager Assigned</SelectItem>
                    {regionalManagers.map((manager) => (
                      <SelectItem key={manager.id} value={manager.id}>
                        {manager.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="submit" className="flex-1">
                  {editingRegion ? 'Update' : 'Create'} Region
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-4">
        <Input
          placeholder="Search regions..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Region Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Regional Manager</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRegions.map((region) => (
              <TableRow key={region.id}>
                <TableCell className="font-medium">{region.name}</TableCell>
                <TableCell>{region.description || '-'}</TableCell>
                <TableCell>{region.regional_manager?.name || 'Unassigned'}</TableCell>
                <TableCell>{new Date(region.created_at).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditModal(region)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(region.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}