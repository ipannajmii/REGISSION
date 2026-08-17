<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

class ProfileAvatarController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user) {
            return response()->json([
                'message' => 'Unauthenticated.',
            ], 401);
        }

        $file = $request->file('avatar')
            ?: $request->file('photo')
            ?: $request->file('image')
            ?: $request->file('profile_photo');

        if (!$file) {
            return response()->json([
                'message' => 'No profile image was received.',
                'errors' => [
                    'avatar' => [
                        'Please choose a JPG, PNG, or WEBP image.',
                    ],
                ],
            ], 422);
        }

        $validator = Validator::make(
            ['avatar' => $file],
            [
                'avatar' => [
                    'required',
                    'image',
                    'mimes:jpg,jpeg,png,webp',
                    'max:3072',
                ],
            ]
        );

        if ($validator->fails()) {
            return response()->json([
                'message' => 'The profile image failed validation.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $avatarColumn = null;

        foreach ([
            'avatar_path',
            'avatar',
            'profile_photo_path',
            'profile_image',
            'photo',
        ] as $column) {
            if (Schema::hasColumn($user->getTable(), $column)) {
                $avatarColumn = $column;
                break;
            }
        }

        if (!$avatarColumn) {
            return response()->json([
                'message' => 'No avatar column exists in the users table.',
            ], 500);
        }

        $oldPath = trim((string) ($user->{$avatarColumn} ?? ''));
        $newPath = $file->store('avatars', 'public');

        if (!$newPath) {
            return response()->json([
                'message' => 'The server could not save the image.',
            ], 500);
        }

        try {
            $user->forceFill([
                $avatarColumn => $newPath,
            ])->save();
        } catch (\Throwable $exception) {
            Storage::disk('public')->delete($newPath);
            throw $exception;
        }

        if (
            $oldPath !== ''
            && $oldPath !== $newPath
            && !str_starts_with($oldPath, 'http://')
            && !str_starts_with($oldPath, 'https://')
        ) {
            $oldPath = str_replace('\\', '/', $oldPath);
            $oldPath = preg_replace(
                '#^(public/|storage/)#',
                '',
                $oldPath
            );

            Storage::disk('public')->delete($oldPath);
        }

        return response()->json([
            'message' => 'Profile photo updated successfully.',
            'avatar_path' => $newPath,
            'avatar_url' => '/storage/' . ltrim($newPath, '/'),
            'user' => $user->fresh(),
        ]);
    }
}
