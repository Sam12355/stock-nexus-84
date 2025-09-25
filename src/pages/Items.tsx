import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Package2, Plus, Edit, Trash2, Search, Thermometer, AlertTriangle } from "lucide-react";
import { z } from "zod";

interface Item {
  id: string;
  name: string;
  category: string;
  description?: string;
  image_url?: string;
  storage_temperature?: number;
  threshold_level: number;
  branch_id: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

const categories = [
  "frozen_items",
  "dry_goods", 
  "packaging",
  "cleaning_supplies",
  "misc"
];

const categoryLabels = {
  frozen_items: "Frozen Items",
  dry_goods: "Dry Goods",
  packaging: "Packaging",
  cleaning_supplies: "Cleaning Supplies", 
  misc: "Miscellaneous"
};

const itemSchema = z.object({
  name: z.string().trim().min(1, "Item name is required").max(100, "Name must be less than 100 characters"),
  category: z.enum(categories as [string, ...string[]], {
    required_error: "Category is required"
  }),
  description: z.string().max(500, "Description must be less than 500 characters").optional(),
  image_url: z.string().url("Please upload an item photo"),
  storage_temperature: z.number().min(-50, "Temperature must be above -50°C").max(100, "Temperature must be below 100°C").optional(),
  threshold_level: z.number().min(1, "Threshold must be at least 1").max(10000, "Threshold must be less than 10,000")
});

const Items = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    description: "",
    image_url: "",
    storage_temperature: "",
    threshold_level: ""
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");

  const fetchItems = async () => {
    try {
      let query = supabase.from('items').select('*');
      
      // Filter by branch if not admin
      if (profile?.role !== 'admin' && profile?.branch_id) {
        query = query.eq('branch_id', profile.branch_id);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Error fetching items:', error);
      toast({
        title: "Error",
        description: "Failed to load items",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    try {
      const processedData = {
        ...formData,
        storage_temperature: formData.storage_temperature ? parseFloat(formData.storage_temperature) : undefined,
        threshold_level: parseInt(formData.threshold_level)
      };
      
      itemSchema.parse(processedData);
      setFormErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path) {
            errors[err.path[0]] = err.message;
          }
        });
        setFormErrors(errors);
      }
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      if (profile?.role === 'admin' && !selectedBranchId) {
        toast({
          title: "Branch required",
          description: "Please select a branch for this item.",
          variant: "destructive",
        });
        return;
      }

      const itemData = {
        name: formData.name.trim(),
        category: formData.category,
        description: formData.description.trim() || null,
        image_url: formData.image_url.trim() || null,
        storage_temperature: formData.storage_temperature ? parseFloat(formData.storage_temperature) : null,
        threshold_level: parseInt(formData.threshold_level),
        branch_id: profile?.role === 'admin' ? selectedBranchId : profile?.branch_id,
        created_by: profile?.user_id
      };

      if (selectedItem) {
        // Update existing item
        const { error } = await supabase
          .from('items')
          .update({
            ...itemData,
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedItem.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Item updated successfully",
        });
        setIsEditModalOpen(false);
      } else {
        // Create new item
        const { error } = await supabase
          .from('items')
          .insert([itemData]);

        if (error) throw error;

        toast({
          title: "Success", 
          description: "Item created successfully",
        });
        setIsAddModalOpen(false);
      }

      fetchItems();
      resetForm();
    } catch (error) {
      console.error('Error saving item:', error);
      const errMsg = (error as any)?.message || "Failed to save item";
      toast({
        title: "Error",
        description: errMsg,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from('items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Item deleted successfully",
      });
      fetchItems();
    } catch (error) {
      console.error('Error deleting item:', error);
      toast({
        title: "Error",
        description: "Failed to delete item",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      category: "",
      description: "",
      image_url: "",
      storage_temperature: "",
      threshold_level: ""
    });
    setFormErrors({});
    setSelectedItem(null);
  };

  const openEditModal = (item: Item) => {
    setSelectedItem(item);
    setFormData({
      name: item.name,
      category: item.category,
      description: item.description || "",
      image_url: item.image_url || "",
      storage_temperature: item.storage_temperature?.toString() || "",
      threshold_level: item.threshold_level.toString()
    });
    setIsEditModalOpen(true);
  };

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const canManageItems = profile?.role === 'admin' || profile?.role === 'manager' || profile?.role === 'assistant_manager';

  useEffect(() => {
    if (canManageItems) {
      fetchItems();
      if (profile?.role === 'admin') {
        supabase
          .from('branches')
          .select('id,name')
          .order('name', { ascending: true })
          .then(({ data, error }) => {
            if (!error) setBranches(data || []);
          });
      }
    }
  }, [canManageItems, profile?.role]);

  if (!canManageItems) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-muted-foreground">You don't have permission to manage items.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading items...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Manage Items</h1>
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" />
              Add New Item
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Package2 className="h-5 w-5" />
                Add New Item
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="item-name">Item Name *</Label>
                <Input
                  id="item-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter item name"
                />
                {formErrors.name && <p className="text-sm text-red-500 mt-1">{formErrors.name}</p>}
              </div>

              <div>
                <Label htmlFor="category">Category *</Label>
                <Select onValueChange={(value) => setFormData({ ...formData, category: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {categoryLabels[category as keyof typeof categoryLabels]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                 {formErrors.category && <p className="text-sm text-red-500 mt-1">{formErrors.category}</p>}

                 {profile?.role === 'admin' && (
                   <div className="mt-2">
                     <Label htmlFor="branch">Branch *</Label>
                     <Select onValueChange={(value) => setSelectedBranchId(value)}>
                       <SelectTrigger>
                         <SelectValue placeholder="Select branch" />
                       </SelectTrigger>
                       <SelectContent>
                         {branches.map((b) => (
                           <SelectItem key={b.id} value={b.id}>
                             {b.name}
                           </SelectItem>
                         ))}
                       </SelectContent>
                     </Select>
                   </div>
                 )}
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Enter item description"
                  rows={3}
                />
                {formErrors.description && <p className="text-sm text-red-500 mt-1">{formErrors.description}</p>}
              </div>

              <div>
                <Label htmlFor="image-url">Item Photo *</Label>
                <Input
                  id="image-url"
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      try {
                        const fileExt = file.name.split('.').pop();
                        const fileName = `${Date.now()}.${fileExt}`;
                        const filePath = `items/${fileName}`;

                        const { error: uploadError } = await supabase.storage
                          .from('user-uploads')
                          .upload(filePath, file);

                        if (uploadError) throw uploadError;

                        const { data } = supabase.storage
                          .from('user-uploads')
                          .getPublicUrl(filePath);

                        setFormData({ ...formData, image_url: data.publicUrl });
                      } catch (error) {
                        console.error('Error uploading image:', error);
                        toast({
                          title: "Error",
                          description: "Failed to upload image",
                          variant: "destructive",
                        });
                      }
                    }
                  }}
                />
                {formData.image_url && (
                  <div className="mt-2">
                    <img src={formData.image_url} alt="Preview" className="w-16 h-16 object-cover rounded" />
                  </div>
                )}
                {formErrors.image_url && <p className="text-sm text-red-500 mt-1">{formErrors.image_url}</p>}
              </div>

              <div>
                <Label htmlFor="storage-temp">Storage Temperature (°C)</Label>
                <div className="relative">
                  <Input
                    id="storage-temp"
                    type="number"
                    step="0.1"
                    value={formData.storage_temperature}
                    onChange={(e) => setFormData({ ...formData, storage_temperature: e.target.value })}
                    placeholder="e.g., -18 for frozen"
                  />
                  <Thermometer className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                </div>
                {formErrors.storage_temperature && <p className="text-sm text-red-500 mt-1">{formErrors.storage_temperature}</p>}
              </div>

              <div>
                <Label htmlFor="threshold">Threshold Level *</Label>
                <div className="relative">
                  <Input
                    id="threshold"
                    type="number"
                    min="1"
                    value={formData.threshold_level}
                    onChange={(e) => setFormData({ ...formData, threshold_level: e.target.value })}
                    placeholder="e.g., 10"
                  />
                  <AlertTriangle className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Alert will be triggered when stock falls below this level
                </p>
                {formErrors.threshold_level && <p className="text-sm text-red-500 mt-1">{formErrors.threshold_level}</p>}
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Add Item</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search Bar */}
      <div className="flex items-center space-x-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search items..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {/* Items Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package2 className="h-5 w-5" />
            Items ({filteredItems.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Storage Temp</TableHead>
                <TableHead>Threshold</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      {item.image_url ? (
                        <img 
                          src={item.image_url} 
                          alt={item.name}
                          className="w-10 h-10 rounded object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                          <Package2 className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Created {new Date(item.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {categoryLabels[item.category as keyof typeof categoryLabels]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-xs">
                      {item.description ? (
                        <p className="text-sm truncate">{item.description}</p>
                      ) : (
                        <span className="text-muted-foreground italic">No description</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {item.storage_temperature ? (
                      <div className="flex items-center gap-1">
                        <Thermometer className="h-4 w-4 text-blue-500" />
                        <span>{item.storage_temperature}°C</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground italic">Not specified</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                      <span>{item.threshold_level}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditModal(item)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="outline">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Item</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{item.name}"? This action cannot be undone and will affect stock records.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(item.id)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filteredItems.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? "No items found matching your search." : "No items found. Add your first item to get started."}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Edit Item
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="edit-item-name">Item Name *</Label>
              <Input
                id="edit-item-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter item name"
              />
              {formErrors.name && <p className="text-sm text-red-500 mt-1">{formErrors.name}</p>}
            </div>

            <div>
              <Label htmlFor="edit-category">Category *</Label>
              <Select 
                value={formData.category} 
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {categoryLabels[category as keyof typeof categoryLabels]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formErrors.category && <p className="text-sm text-red-500 mt-1">{formErrors.category}</p>}
            </div>

            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter item description"
                rows={3}
              />
              {formErrors.description && <p className="text-sm text-red-500 mt-1">{formErrors.description}</p>}
            </div>

            <div>
              <Label htmlFor="edit-image-url">Item Photo *</Label>
              <Input
                id="edit-image-url"
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    try {
                      const fileExt = file.name.split('.').pop();
                      const fileName = `${Date.now()}.${fileExt}`;
                      const filePath = `items/${fileName}`;

                      const { error: uploadError } = await supabase.storage
                        .from('user-uploads')
                        .upload(filePath, file);

                      if (uploadError) throw uploadError;

                      const { data } = supabase.storage
                        .from('user-uploads')
                        .getPublicUrl(filePath);

                      setFormData({ ...formData, image_url: data.publicUrl });
                    } catch (error) {
                      console.error('Error uploading image:', error);
                      toast({
                        title: "Error",
                        description: "Failed to upload image",
                        variant: "destructive",
                      });
                    }
                  }
                }}
              />
              {formData.image_url && (
                <div className="mt-2">
                  <img src={formData.image_url} alt="Preview" className="w-16 h-16 object-cover rounded" />
                </div>
              )}
              {formErrors.image_url && <p className="text-sm text-red-500 mt-1">{formErrors.image_url}</p>}
            </div>

            <div>
              <Label htmlFor="edit-storage-temp">Storage Temperature (°C)</Label>
              <div className="relative">
                <Input
                  id="edit-storage-temp"
                  type="number"
                  step="0.1"
                  value={formData.storage_temperature}
                  onChange={(e) => setFormData({ ...formData, storage_temperature: e.target.value })}
                  placeholder="e.g., -18 for frozen"
                />
                <Thermometer className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
              </div>
              {formErrors.storage_temperature && <p className="text-sm text-red-500 mt-1">{formErrors.storage_temperature}</p>}
            </div>

            <div>
              <Label htmlFor="edit-threshold">Threshold Level *</Label>
              <div className="relative">
                <Input
                  id="edit-threshold"
                  type="number"
                  min="1"
                  value={formData.threshold_level}
                  onChange={(e) => setFormData({ ...formData, threshold_level: e.target.value })}
                  placeholder="e.g., 10"
                />
                <AlertTriangle className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Alert will be triggered when stock falls below this level
              </p>
              {formErrors.threshold_level && <p className="text-sm text-red-500 mt-1">{formErrors.threshold_level}</p>}
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Update Item</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Items;