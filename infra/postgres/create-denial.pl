use strict;
use warnings;
use Cwd qw(abs_path);
use Fcntl qw(O_WRONLY O_CREAT O_EXCL O_NOFOLLOW S_ISDIR S_ISREG);
use Errno qw(EACCES EROFS ENOENT);

my $directory = '/var/lib/postgresql/data/pgdata/base/pgsql_tmp';
my $owner = 999;
my $group = 999;
my $filename;
my $handle;
my $created = 0;
my $outcome = 'unknown';
my $error_class = 'other';
my $cleanup = 'not_created';
my %snapshots;

sub directory_state {
    my ($path, $mode) = @_;
    my @metadata = lstat($path);
    die "metadata\n" unless @metadata && S_ISDIR($metadata[2]) &&
        $metadata[4] == $owner && $metadata[5] == $group &&
        ($metadata[2] & 07777) == $mode &&
        (abs_path($path) // '') eq $path;
    return join(':', @metadata[0,1,2,4,5]);
}
sub same_tree {
    for my $path (keys %snapshots) {
        my $mode = $path eq $directory ? 0555 : 0700;
        die "changed\n" unless directory_state($path, $mode) eq $snapshots{$path};
    }
}
sub empty_directory {
    opendir(my $entries, $directory) or die "directory\n";
    $! = 0;
    while (defined(my $entry = readdir($entries))) {
        next if $entry eq '.' || $entry eq '..';
        closedir($entries);
        die "nonempty\n";
    }
    my $read_error = 0 + $!;
    closedir($entries) or die "directory\n";
    die "directory\n" if $read_error;
}
sub absent {
    my @metadata = lstat($filename);
    my $number = 0 + $!;
    die "presence\n" unless !@metadata && $number == ENOENT;
}
sub owned_empty_file {
    my @descriptor = stat($handle);
    my @named = lstat($filename);
    die "file\n" unless @descriptor && @named &&
        S_ISREG($descriptor[2]) && S_ISREG($named[2]) &&
        $descriptor[3] == 1 && $descriptor[4] == $owner && $descriptor[5] == $group &&
        ($descriptor[2] & 07777) == 0600 && $descriptor[7] == 0 &&
        join(':', @descriptor[0,1,2,3,4,5,7]) eq join(':', @named[0,1,2,3,4,5,7]);
}
$SIG{ALRM} = $SIG{INT} = $SIG{TERM} = sub { die "interrupted\n"; };
alarm 5;
my $checked = eval {
    my @groups = (split(' ', $(), split(' ', $)));
    die "identity\n" unless !@ARGV && $< == $owner && $> == $owner &&
        @groups && !grep { $_ != $group } @groups;
    open(my $random, '<:raw', '/dev/urandom') or die "random\n";
    read($random, my $bytes, 16) == 16 or die "random\n";
    close($random) or die "random\n";
    my $token = unpack('H*', $bytes);
    $filename = "$directory/.u1-create-denial-$token";
    for my $path ('/var/lib/postgresql/data/pgdata',
                  '/var/lib/postgresql/data/pgdata/base', $directory) {
        $snapshots{$path} = directory_state($path, $path eq $directory ? 0555 : 0700);
    }
    empty_directory();
    absent();
    umask 0077;
    if (sysopen($handle, $filename, O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW, 0600)) {
        $created = 1;
        $outcome = 'created';
        $error_class = 'none';
        $cleanup = 'unknown';
    } else {
        my $number = 0 + $!;
        if ($number == EACCES) { $outcome = 'denied'; $error_class = 'EACCES'; }
        elsif ($number == EROFS) { $outcome = 'denied'; $error_class = 'EROFS'; }
        same_tree();
        absent();
        empty_directory();
    }
    1;
};
if (!$checked && !$created) {
    $outcome = 'unknown';
    $error_class = 'other';
    $cleanup = 'unknown';
}
if ($created) {
    alarm 5;
    my $removed = eval {
        same_tree();
        owned_empty_file();
        unlink($filename) == 1 or die "unlink\n";
        my @remaining = stat($handle);
        die "unlink\n" unless @remaining && $remaining[3] == 0 && $remaining[7] == 0;
        close($handle) or die "close\n";
        absent();
        same_tree();
        empty_directory();
        1;
    };
    $cleanup = $removed ? 'removed' : 'unknown';
}
alarm 0;
print "U1_CREATE_DENIAL $outcome $error_class $cleanup\n";
exit(($checked && $outcome eq 'denied' && $cleanup eq 'not_created') ? 0 : 1);
