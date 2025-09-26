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

interface District {
  id: string;
  name: string;
  description: string | null;
  region_id: string;
  created_at: string;
  region: {
    name: string;
  };
}

interface Region {
  id: string;
  name: string;
}

const districtSchema = z.object({
  name: z.string().trim().min(1, "District name is required").max(100, "District name must be less than 100 characters"),
  description: z.string().max(500, "Description must be less than 500 characters").optional(),
  region_id: z.string().min(1, "Region selection is required")
});

export default function DistrictManagement() {
  const { profile } = useAuth();
  const [districts, setDistricts] = useState<District[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDistrict, setEditingDistrict] = useState<District | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    region_id: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if ((profile?.role as string) === 'admin') {
      fetchDistricts();
      fetchRegions();
    }
  }, [profile]);

  const fetchDistricts = async () => {
    try {
      const { data, error } = await supabase
        .from('districts')
        .select(`
          *,
          region:regions!region_id(name)
        `)
        .order('name');

      if (error) throw error;
      setDistricts(data || []);
    } catch (error) {
      console.error('Error fetching districts:', error);
      toast({
        title: "Error",
        description: "Failed to fetch districts",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchRegions = async () => {
    try {
      const { data, error } = await supabase
        .from('regions')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setRegions(data || []);
    } catch (error) {
      console.error('Error fetching regions:', error);
    }
  };

  const validateForm = () => {
    try {
      districtSchema.parse(formData);
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
      const districtData = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        region_id: formData.region_id
      };

      if (editingDistrict) {
        const { error } = await supabase
          .from('districts')
          .update(districtData)
          .eq('id', editingDistrict.id);

        if (error) throw error;
        toast({
          title: "Success",
          description: "District updated successfully"
        });
      } else {
        const { error } = await supabase
          .from('districts')
          .insert([districtData]);

        if (error) throw error;
        toast({
          title: "Success",
          description: "District created successfully"
        });
      }

      resetForm();
      fetchDistricts();
    } catch (error) {
      console.error('Error saving district:', error);
      toast({
        title: "Error",
        description: "Failed to save district",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this district? This will also delete all associated branches.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('districts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast({
        title: "Success",
        description: "District deleted successfully"
      });
      fetchDistricts();
    } catch (error) {
      console.error('Error deleting district:', error);
      toast({
        title: "Error",
        description: "Failed to delete district",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      region_id: ''
    });
    setEditingDistrict(null);
    setIsModalOpen(false);
    setErrors({});
  };

  const openEditModal = (district: District) => {
    setFormData({
      name: district.name,
      description: district.description || '',
      region_id: district.region_id
    });
    setEditingDistrict(district);
    setIsModalOpen(true);
  };

  const filteredDistricts = districts.filter(district =>
    district.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    district.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    district.region.name.toLowerCase().includes(searchTerm.toLowerCase())
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
        <h1 className="text-3xl font-bold">District Management</h1>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()}>
              <Plus className="mr-2 h-4 w-4" />
              Add District
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingDistrict ? 'Edit District' : 'Add New District'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="region">Region *</Label>
                <Select
                  value={formData.region_id}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, region_id: value }))}
                >
                  <SelectTrigger className={errors.region_id ? "border-destructive" : ""}>
                    <SelectValue placeholder="Select region" />
                  </SelectTrigger>
                  <SelectContent>
                    {regions.map((region) => (
                      <SelectItem key={region.id} value={region.id}>
                        {region.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.region_id && <p className="text-sm text-destructive mt-1">{errors.region_id}</p>}
              </div>

              <div>
                <Label htmlFor="name">District Name *</Label>
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

              <div className="flex gap-2 pt-4">
                <Button type="submit" className="flex-1">
                  {editingDistrict ? 'Update' : 'Create'} District
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
          placeholder="Search districts..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>District Name</TableHead>
              <TableHead>Region</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredDistricts.map((district) => (
              <TableRow key={district.id}>
                <TableCell className="font-medium">{district.name}</TableCell>
                <TableCell>{district.region.name}</TableCell>
                <TableCell>{district.description || '-'}</TableCell>
                <TableCell>{new Date(district.created_at).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditModal(district)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(district.id)}
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