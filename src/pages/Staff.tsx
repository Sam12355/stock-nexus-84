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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Users, Plus, Edit, Trash2, Search, UserPlus } from "lucide-react";
import { z } from "zod";

interface StaffMember {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone?: string;
  photo_url?: string;
  position?: string;
  role: 'admin' | 'manager' | 'assistant_manager' | 'staff';
  branch_id?: string;
  last_access?: string;
  access_count: number;
  created_at: string;
  updated_at: string;
}

const staffSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  email: z.string().trim().email("Invalid email address").max(255, "Email must be less than 255 characters"),
  phone: z.string().optional(),
  position: z.string().optional(),
  role: z.enum(['admin', 'manager', 'assistant_manager', 'staff'], {
    required_error: "Role is required"
  }),
  photo_url: z.string().url().optional().or(z.literal(""))
});

const Staff = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    position: "",
    role: "staff" as 'admin' | 'manager' | 'assistant_manager' | 'staff',
    photo_url: ""
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const fetchStaffMembers = async () => {
    try {
      let query = supabase.from('profiles').select('*');
      
      // Filter based on user role
      if (profile?.role === 'manager' || profile?.role === 'assistant_manager') {
        query = query.eq('branch_id', profile.branch_id);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      setStaffMembers(data || []);
    } catch (error) {
      console.error('Error fetching staff members:', error);
      toast({
        title: "Error",
        description: "Failed to load staff members",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    try {
      staffSchema.parse(formData);
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
      if (selectedStaff) {
        // Update existing staff member
        const { error } = await supabase
          .from('profiles')
          .update({
            name: formData.name.trim(),
            email: formData.email.trim(),
            phone: formData.phone.trim() || null,
            position: formData.position.trim() || null,
            role: formData.role,
            photo_url: formData.photo_url.trim() || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedStaff.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Staff member updated successfully",
        });
        setIsEditModalOpen(false);
      } else {
        // Create new staff member profile directly
        const { error } = await supabase
          .from('profiles')
          .insert([{
            name: formData.name.trim(),
            email: formData.email.trim(),
            phone: formData.phone.trim() || null,
            position: formData.position.trim() || null,
            role: formData.role,
            photo_url: formData.photo_url.trim() || null,
            branch_id: profile?.branch_id,
            user_id: crypto.randomUUID(), // Generate a temporary UUID for demonstration
            access_count: 0
          }]);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Staff member created successfully",
        });
        setIsAddModalOpen(false);
      }

      fetchStaffMembers();
      resetForm();
    } catch (error) {
      console.error('Error saving staff member:', error);
      toast({
        title: "Error",
        description: "Failed to save staff member",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (staffId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', staffId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Staff member deleted successfully",
      });
      fetchStaffMembers();
    } catch (error) {
      console.error('Error deleting staff member:', error);
      toast({
        title: "Error",
        description: "Failed to delete staff member",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      position: "",
      role: "staff" as 'admin' | 'manager' | 'assistant_manager' | 'staff',
      photo_url: ""
    });
    setFormErrors({});
    setSelectedStaff(null);
  };

  const openEditModal = (staff: StaffMember) => {
    setSelectedStaff(staff);
    setFormData({
      name: staff.name,
      email: staff.email,
      phone: staff.phone || "",
      position: staff.position || "",
      role: staff.role,
      photo_url: staff.photo_url || ""
    });
    setIsEditModalOpen(true);
  };

  const filteredStaff = staffMembers.filter(staff =>
    staff.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    staff.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    staff.position?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    staff.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const canManageStaff = profile?.role === 'admin' || profile?.role === 'manager' || profile?.role === 'assistant_manager';

  useEffect(() => {
    if (canManageStaff) {
      fetchStaffMembers();
    }
  }, [canManageStaff]);

  if (!canManageStaff) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-muted-foreground">You don't have permission to manage staff.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading staff members...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Manage Staff</h1>
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" />
              Add Staff Member
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Add New Staff Member
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter full name"
                />
                {formErrors.name && <p className="text-sm text-red-500 mt-1">{formErrors.name}</p>}
              </div>

              <div>
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Enter email address"
                />
                {formErrors.email && <p className="text-sm text-red-500 mt-1">{formErrors.email}</p>}
              </div>

              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="Enter phone number"
                />
                {formErrors.phone && <p className="text-sm text-red-500 mt-1">{formErrors.phone}</p>}
              </div>

              <div>
                <Label htmlFor="position">Position</Label>
                <Input
                  id="position"
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  placeholder="e.g., Warehouse Assistant"
                />
                {formErrors.position && <p className="text-sm text-red-500 mt-1">{formErrors.position}</p>}
              </div>

              <div>
                <Label htmlFor="role">Role *</Label>
                <Select onValueChange={(value: any) => setFormData({ ...formData, role: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="assistant_manager">Assistant Manager</SelectItem>
                    {profile?.role === 'admin' && (
                      <SelectItem value="manager">Manager</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {formErrors.role && <p className="text-sm text-red-500 mt-1">{formErrors.role}</p>}
              </div>

              <div>
                <Label htmlFor="photo_url">Staff Photo</Label>
                <Input
                  id="photo_url"
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      try {
                        const fileExt = file.name.split('.').pop();
                        const fileName = `${Date.now()}.${fileExt}`;
                        const filePath = `staff/${fileName}`;

                        const { error: uploadError } = await supabase.storage
                          .from('user-uploads')
                          .upload(filePath, file);

                        if (uploadError) throw uploadError;

                        const { data } = supabase.storage
                          .from('user-uploads')
                          .getPublicUrl(filePath);

                        setFormData({ ...formData, photo_url: data.publicUrl });
                      } catch (error) {
                        console.error('Error uploading photo:', error);
                        toast({
                          title: "Error",
                          description: "Failed to upload photo",
                          variant: "destructive",
                        });
                      }
                    }
                  }}
                />
                {formData.photo_url && (
                  <div className="mt-2">
                    <img src={formData.photo_url} alt="Preview" className="w-16 h-16 object-cover rounded" />
                  </div>
                )}
                {formErrors.photo_url && <p className="text-sm text-red-500 mt-1">{formErrors.photo_url}</p>}
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Add Staff Member</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search Bar */}
      <div className="flex items-center space-x-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search staff members..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {/* Staff Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Staff Members ({filteredStaff.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff Member</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Last Access</TableHead>
                <TableHead>Access Count</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStaff.map((staff) => (
                <TableRow key={staff.id}>
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <Avatar>
                        <AvatarImage src={staff.photo_url} alt={staff.name} />
                        <AvatarFallback>
                          {staff.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{staff.name}</p>
                        <p className="text-sm text-muted-foreground">{staff.email}</p>
                        {staff.phone && (
                          <p className="text-sm text-muted-foreground">{staff.phone}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {staff.position || <span className="text-muted-foreground italic">Not specified</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {staff.role.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {staff.last_access 
                      ? new Date(staff.last_access).toLocaleDateString()
                      : <span className="text-muted-foreground italic">Never</span>
                    }
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{staff.access_count}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditModal(staff)}
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
                            <AlertDialogTitle>Delete Staff Member</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete {staff.name}? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(staff.id)}>
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

          {filteredStaff.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? "No staff members found matching your search." : "No staff members found."}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Edit Staff Member
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Full Name *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter full name"
              />
              {formErrors.name && <p className="text-sm text-red-500 mt-1">{formErrors.name}</p>}
            </div>

            <div>
              <Label htmlFor="edit-email">Email Address *</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="Enter email address"
              />
              {formErrors.email && <p className="text-sm text-red-500 mt-1">{formErrors.email}</p>}
            </div>

            <div>
              <Label htmlFor="edit-phone">Phone Number</Label>
              <Input
                id="edit-phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="Enter phone number"
              />
              {formErrors.phone && <p className="text-sm text-red-500 mt-1">{formErrors.phone}</p>}
            </div>

            <div>
              <Label htmlFor="edit-position">Position</Label>
              <Input
                id="edit-position"
                value={formData.position}
                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                placeholder="e.g., Warehouse Assistant"
              />
              {formErrors.position && <p className="text-sm text-red-500 mt-1">{formErrors.position}</p>}
            </div>

            <div>
              <Label htmlFor="edit-role">Role *</Label>
              <Select 
                value={formData.role} 
                onValueChange={(value: any) => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="assistant_manager">Assistant Manager</SelectItem>
                  {profile?.role === 'admin' && (
                    <SelectItem value="manager">Manager</SelectItem>
                  )}
                </SelectContent>
              </Select>
              {formErrors.role && <p className="text-sm text-red-500 mt-1">{formErrors.role}</p>}
            </div>

            <div>
              <Label htmlFor="edit-photo_url">Staff Photo</Label>
              <Input
                id="edit-photo_url"
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    try {
                      const fileExt = file.name.split('.').pop();
                      const fileName = `${Date.now()}.${fileExt}`;
                      const filePath = `staff/${fileName}`;

                      const { error: uploadError } = await supabase.storage
                        .from('user-uploads')
                        .upload(filePath, file);

                      if (uploadError) throw uploadError;

                      const { data } = supabase.storage
                        .from('user-uploads')
                        .getPublicUrl(filePath);

                      setFormData({ ...formData, photo_url: data.publicUrl });
                    } catch (error) {
                      console.error('Error uploading photo:', error);
                      toast({
                        title: "Error",
                        description: "Failed to upload photo",
                        variant: "destructive",
                      });
                    }
                  }
                }}
              />
              {formData.photo_url && (
                <div className="mt-2">
                  <img src={formData.photo_url} alt="Preview" className="w-16 h-16 object-cover rounded" />
                </div>
              )}
              {formErrors.photo_url && <p className="text-sm text-red-500 mt-1">{formErrors.photo_url}</p>}
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Update Staff Member</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Staff;